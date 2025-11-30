import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

interface EmailData {
    name: string;
    email: string;
    service: string;
    message: string;
}

// Разрешаем CORS
function allowCors(res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
}

export default async function handler(
    request: VercelRequest,
    response: VercelResponse
) {
    // Обрабатываем CORS
    allowCors(response);

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const { name, email, service, message }: EmailData = request.body;

        // Валидация
        if (!name || !email || !service || !message) {
            return response.status(400).json({
                success: false,
                message: 'Все поля обязательны для заполнения'
            });
        }

        // Проверяем email формат
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return response.status(400).json({
                success: false,
                message: 'Некорректный формат email'
            });
        }

        console.log('Получены данные:', { name, email, service, message: message.substring(0, 50) + '...' });

        // Создаем транспортер для Gmail
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        console.log('Проверяем подключение к SMTP...');

        // Проверяем подключение
        await transporter.verify();
        console.log('SMTP подключение успешно');

        // HTML версия письма
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { background: #f5f5f5; padding: 20px; }
        .field { margin-bottom: 15px; }
        .field strong { color: #555; }
        .message { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea; margin-top: 10px; }
        .footer { color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Новая заявка с сайта</h1>
    </div>
    <div class="content">
        <div class="field"><strong>👤 Имя:</strong> ${name}</div>
        <div class="field"><strong>📧 Email:</strong> ${email}</div>
        <div class="field"><strong>🛠 Услуга:</strong> ${service}</div>
        <div class="field"><strong>💬 Сообщение:</strong></div>
        <div class="message">${message.replace(/\n/g, '<br>')}</div>
    </div>
    <div class="footer">
        <p><strong>📅 Отправлено:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <p><strong>🌐 IP:</strong> ${request.headers['x-forwarded-for'] || request.socket.remoteAddress}</p>
    </div>
</body>
</html>
    `;

        // Текстовая версия письма
        const emailText = `
Новая заявка с вашего сайта-визитки:

👤 Имя: ${name}
📧 Email: ${email}
🛠 Услуга: ${service}
💬 Сообщение: ${message}

📅 Отправлено: ${new Date().toLocaleString('ru-RU')}
🌐 IP: ${request.headers['x-forwarded-for'] || request.socket.remoteAddress}
    `;

        console.log('Отправляем письмо...');

        // Отправляем письмо
        const mailResult = await transporter.sendMail({
            from: `"Сайт-визитка" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: `🎯 Новая заявка: ${service} - ${name}`,
            text: emailText,
            html: emailHtml,
        });

        console.log('Письмо успешно отправлено! ID:', mailResult.messageId);

        response.status(200).json({
            success: true,
            message: 'Сообщение успешно отправлено! Я свяжусь с вами в течение 24 часов.'
        });

    } catch (error: any) {
        console.error('❌ Ошибка отправки:', error);

        let errorMessage = 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.';

        if (error.code === 'EAUTH') {
            errorMessage = 'Ошибка авторизации почтового сервера. Проверьте настройки email и пароля.';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Не удалось подключиться к почтовому серверу.';
        }

        response.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}