import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

interface EmailData {
    name: string;
    email: string;
    service: string;
    message: string;
}

export default async function handler(
    request: VercelRequest,
    response: VercelResponse
) {
    // ЖЕСТКО прописываем CORS заголовки
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    };

    // Устанавливаем все заголовки
    Object.entries(headers).forEach(([key, value]) => {
        response.setHeader(key, value);
    });

    // НЕМЕДЛЕННО отвечаем на OPTIONS запрос
    if (request.method === 'OPTIONS') {
        console.log('✅ OPTIONS запрос обработан');
        response.status(200).end();
        return;
    }

    // Только POST запросы
    if (request.method !== 'POST') {
        response.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
        return;
    }

    try {
        const { name, email, service, message } = request.body;

        console.log('📧 Получена заявка:', { name, email, service });

        // Валидация
        if (!name || !email || !service || !message) {
            response.status(400).json({ 
                success: false, 
                message: 'Все поля обязательны для заполнения' 
            });
            return;
        }

        // Проверяем email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            response.status(400).json({ 
                success: false, 
                message: 'Некорректный формат email' 
            });
            return;
        }

        // Проверяем переменные окружения
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.error('❌ Не настроены переменные окружения');
            response.status(500).json({ 
                success: false, 
                message: 'Сервер не настроен' 
            });
            return;
        }

        // Настраиваем почтовый клиент
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        // Проверяем подключение
        await transporter.verify();
        console.log('✅ SMTP подключение успешно');

        // Отправляем письмо
        await transporter.sendMail({
            from: `"Сайт-визитка" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: `🎯 Новая заявка: ${service} - ${name}`,
            html: `
                <h2>Новая заявка с сайта</h2>
                <p><strong>Имя:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Услуга:</strong> ${service}</p>
                <p><strong>Сообщение:</strong> ${message}</p>
                <p><em>Отправлено: ${new Date().toLocaleString('ru-RU')}</em></p>
            `,
            text: `Имя: ${name}\nEmail: ${email}\nУслуга: ${service}\nСообщение: ${message}`
        });

        console.log('✅ Письмо успешно отправлено');

        response.status(200).json({
            success: true,
            message: 'Сообщение успешно отправлено! Я свяжусь с вами в течение 24 часов.'
        });

    } catch (error: any) {
        console.error('❌ Ошибка:', error);

        let errorMessage = 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.';

        if (error.code === 'EAUTH') {
            errorMessage = 'Ошибка авторизации почтового сервера. Проверьте настройки email и пароля.';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Не удалось подключиться к почтовому серверу.';
        }

        response.status(500).json({
            success: false,
            message: errorMessage
        });
    }
}