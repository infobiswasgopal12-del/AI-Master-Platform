const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_JSON)) });
const db = admin.firestore();

module.exports = async (req, res) => {
    const data = JSON.parse(req.body);
    const { uid, upi } = data;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const walletBalance = userDoc.data().wallet || 0;

    if (walletBalance < 50) {
        return res.status(200).send(`Withdrawal failed. Minimum balance ₹50 required.`);
    }

    // Wallet se paise katna
    await userRef.update({ wallet: admin.firestore.FieldValue.increment(-walletBalance) });

    // Withdrawals list mein dalna
    await db.collection('withdrawals').add({
        uid: uid,
        upiId: upi,
        amount: walletBalance,
        status: 'Pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).send(`Success! ₹${walletBalance} will be sent to ${upi}.`);
};