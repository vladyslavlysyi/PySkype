# Skype Web Clone 🚀

Сучасний веб-клон Skype, побудований на стеку: Next.js 14, Tailwind CSS, Socket.io, WebRTC та PostgreSQL (Prisma).
Підтримує пошук користувачів, обмін текстовими повідомленнями в реальному часі та відео/аудіо дзвінки (P2P).

## Структура Проекту (File Tree)

```text
skype-clone/
├── prisma/
│   └── schema.prisma           # Опис моделі бази даних (Users, Messages, Conversations)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   ├── auth/           # Ендпоінти для реєстрації та логіну (JWT)
│   │   │   ├── chats/          # REST API для чатів та повідомлень
│   │   │   └── users/search/   # REST API для пошуку користувачів
│   │   ├── layout.tsx          # Головний RootLayout із <SocketProvider>
│   │   └── page.tsx            # Головний інтерфейс чату (Sidebar, ChatArea, CallOverlay)
│   ├── components/             # React-компоненти
│   │   ├── Sidebar.tsx         # Бічне меню з контактами та пошуком
│   │   ├── ChatArea.tsx        # Зона повідомлень
│   │   └── CallOverlay.tsx     # Інтерфейс дзвінка (модальне вікно та WebRTC Grid)
│   ├── contexts/
│   │   └── SocketContext.tsx   # Провайдер підключення до Socket.io
│   ├── hooks/
│   │   └── useWebRTC.ts        # Хук для роботи з P2P-з'єднаннями (RTCPeerConnection)
│   ├── lib/
│   │   ├── auth.ts             # Утиліти хешування та генерації JWT
│   │   └── prisma.ts           # Prisma Client Singleton
│   ├── socket/
│   │   └── socketHandler.ts    # Типізована логіка для Socket.io сервера (Signaling, Messages)
│   └── store/
│       └── useAppStore.ts      # Zustand сховище глобального стану (клієнт)
├── server.js                   # Node.js + Express кастомний сервер для Next.js та Socket.io
├── package.json
└── .env.example                # Приклад змінних середовища
```

## Інструкція Запуску (Local Development)

1. **Встановлення залежностей:**
   Переконайтеся, що ви скопіювали вміст `package.json` та запустіть:
   ```bash
   npm install
   ```
   Додатково знадобиться: `npm install zustand lucide-react clsx tailwind-merge`

2. **Налаштування бази даних:**
   Скопіюйте файл конфігурації та вкажіть ваші дані підключення (PostgreSQL).
   ```bash
   cp .env.example .env
   ```
   Запустіть міграцію для створення таблиць:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Запуск сервера:**
   Оскільки у нас є і Next.js, і Socket.io, ми використовуємо кастомний Node.js сервер.
   ```bash
   npm run dev
   # Або напряму: node server.js
   ```

4. Відкрийте браузер за адресою: `http://localhost:3000`

## Деплой у Production

Оскільки ми використовуємо WebSockets та WebRTC, стандартний деплой на Vercel (де функції працюють як Serverless) **НЕ ПІДХОДИТЬ** для `server.js` частини, оскільки Vercel обриває WebSocket-з'єднання.

### Варіант 1: Render / Railway / DigitalOcean (Рекомендовано)
Ці сервіси дозволяють запускати повноцінні Node.js сервери.
1. Прив'яжіть свій GitHub репозиторій.
2. Вкажіть Build Command: `npm install && npx prisma generate && npm run build`
3. Вкажіть Start Command: `npm start`
4. Не забудьте додати всі змінні середовища (DATABASE_URL, JWT_SECRET, NEXT_PUBLIC_SITE_URL).

### Варіант 2: Docker
Якщо ви хочете підняти проект на власному VPS (наприклад, Ubuntu-сервер), ви можете використати такий `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## WebRTC TURN Сервери
Для того щоб відеодзвінки працювали між користувачами, які знаходяться за різними NAT/Firewall роутерами (наприклад, через 4G), STUN серверів недостатньо. 
У Production використовуйте платні/відкриті TURN сервери (наприклад Twilio Network Traversal або Metered TURN) та додайте їх у `useWebRTC.ts`.
