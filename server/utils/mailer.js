import dotenv from 'dotenv';
dotenv.config();

export const sendMail = async ({ to, subject, text }) => {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'IITK Placement Portal', email: 'smartcheese176@gmail.com' },
                to: [{ email: to }],
                subject,
                textContent: text
            })
        });
        if (!response.ok) {
            const err = await response.json();
            console.error('❌ Brevo Error:', err);
            return false;
        }
        return true;
    } catch(error) {
        console.error('❌ Email Error:', error);
        return false;
    }
};
