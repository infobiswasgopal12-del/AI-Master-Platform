const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_JSON)) });
const db = admin.firestore();

module.exports = async (req, res) => {
    const data = JSON.parse(req.body);
    const { uid, planAmount } = data; 

    // Timer calculation: ₹14 = 1 Hr (3600000ms), ₹30 = 24 Hrs (86400000ms)
    const timeToAdd = planAmount === 30 ? 86400000 : 3600000; 

    const sessionRef = db.collection('sessions').doc(uid);
    const session = (await sessionRef.get()).data();
    
    let parts = [{ text: `System: Give 100% accurate, practical step-by-step solution. Problem: ${session.tempText}` }];
    if (session.tempImg) parts.push({ inlineData: { mimeType: session.tempImg.split(';')[0].split(':')[1], data: session.tempImg.split(',')[1] } });
    
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: parts }] })
    });
    const aiText = (await aiRes.json()).candidates[0].content.parts[0].text;

    await sessionRef.update({
        status: 'active',
        expiresAt: Date.now() + timeToAdd,
        chat: [{ role: 'user', text: session.tempText || "Image attached" }, { role: 'model', text: aiText }],
        tempText: admin.firestore.FieldValue.delete(), tempImg: admin.firestore.FieldValue.delete()
    });

    // REFERRAL WALLET LOGIC
    const userDoc = await db.collection('users').doc(uid).get();
    const referredBy = userDoc.data().referredBy;

    if (referredBy) {
        const referrerRef = db.collection('users').doc(referredBy);
        const referrerData = (await referrerRef.get()).data();
        
        if (referrerData) {
            const todayStr = new Date().toISOString().split('T')[0];
            let dailyCount = referrerData.dailyCount || 0;
            let lastRefDate = referrerData.lastRefDate || todayStr;

            // Reset logic for next day
            if (lastRefDate !== todayStr) {
                dailyCount = 0;
                lastRefDate = todayStr;
            }

            dailyCount += 1;
            const rewardAmount = dailyCount >= 10 ? 7 : 5; 

            await referrerRef.update({
                wallet: admin.firestore.FieldValue.increment(rewardAmount),
                dailyCount: dailyCount,
                lastRefDate: lastRefDate
            });
        }
    }

    res.status(200).send('OK');
};