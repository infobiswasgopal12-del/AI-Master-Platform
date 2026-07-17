const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_JSON)) });
const db = admin.firestore();

module.exports = async (req, res) => {
    const data = JSON.parse(req.body);
    const docRef = db.collection('sessions').doc(data.uid);
    const session = (await docRef.get()).data();

    if(session.status !== 'active' || Date.now() > session.expiresAt) return res.status(403).send('Expired');

    let history = session.chat || [];
    history.push({ role: 'user', text: data.text });
    const formattedContext = history.map(m => ({ role: m.role, parts: [{ text: m.text }] }));

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: formattedContext })
    });
    
    const aiText = (await aiRes.json()).candidates[0].content.parts[0].text;
    history.push({ role: 'model', text: aiText });

    await docRef.update({ chat: history });
    res.status(200).send('OK');
};