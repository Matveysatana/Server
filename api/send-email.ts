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
    // Устанавливаем CORS заголовки ПЕРВЫМИ
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Обрабатываем OPTIONS запрос сразу
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    // Только POST запросы
    if (request.method !== 'POST') {
        return response.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const { name, email, service, message } = request.body;

        // Простая валидация
        if (!name || !email || !service || !message) {
            return response.status(400).json({
                success: false,
                message: 'Все поля обязательны'
            });
        }

        console.log('Получен запрос от:', email);

        // Проверяем наличие переменных окружения
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.error('Не настроены переменные окружения');
            return response.status(500).json({
                success: false,
                message: 'Сервер не настроен'
            });
        }

        // Создаем транспортер
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        // Отправляем письмо
        await transporter.sendMail({
            from: `"Сайт-визитка" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: `Новая заявка: ${service} - ${name}`,
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

        console.log('Письмо отправлено успешно');

        response.status(200).json({
            success: true,
            message: 'Сообщение отправлено!'
        });

    } catch (error: any) {
        console.error('Ошибка:', error);

        response.status(500).json({
            success: false,
            message: 'Ошибка сервера: ' + (error.message || 'Неизвестная ошибка')
        });
    }
}