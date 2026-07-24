# Skype Web Clone (FastAPI Edition) 🚀

Сучасний веб-клон Skype, побудований на стеку: Next.js 14, Tailwind CSS, FastAPI, WebSockets, WebRTC та PostgreSQL (SQLAlchemy 2.0).
Підтримує пошук користувачів, обмін текстовими повідомленнями в реальному часі та відео/аудіо дзвінки (P2P).

## Структура Проекту (File Tree)

```text
skype-clone/
├── backend/                     # Python / FastAPI Backend
│   ├── app/
│   │   ├── main.py              # Точка входу FastAPI
│   │   ├── database.py          # SQLAlchemy Async Engine
│   │   ├── models.py            # SQLAlchemy Моделі (Users, Messages)
│   │   ├── schemas.py           # Pydantic схеми для валідації
│   │   ├── auth.py              # JWT-логіка та хешування (bcrypt)
│   │   ├── routes/              # REST ендпоінти
│   │   └── sockets/             # WebSockets (ConnectionManager, Signaling)
│   ├── requirements.txt         # Залежності бекенду
│   └── Dockerfile               # Докерфайл для бекенду
├── src/                         # Next.js App Router (Frontend)
│   ├── app/
│   ├── components/              # UI-компоненти (Tailwind, Lucide)
│   ├── contexts/                # WebSocketProvider для нативного WS
│   ├── hooks/                   # useWebRTC хук
│   └── store/                   # Zustand (стейт-менеджмент)
├── docker-compose.yml           # Файл для підняття всієї інфраструктури
├── Dockerfile                   # Докерфайл для фронтенду (Standalone)
└── .env.example                 # Приклад змінних середовища
```

## Інструкція Запуску через Docker (Рекомендовано)

Завдяки Docker Compose, вам не потрібно встановлювати Python на вашу машину. 

1. Переконайтеся, що у вас встановлено Docker та Docker Compose.
2. Відкрийте термінал у кореневій папці проекту.
3. Виконайте команду:
   ```bash
   docker-compose up -d --build
   ```

**Що відбудеться:**
- Підніметься контейнер бази даних PostgreSQL (на порту 5432).
- Підніметься FastAPI бекенд (на порту 8000). При старті він автоматично створить усі необхідні таблиці в базі даних (через `Base.metadata.create_all`).
- Скомпілюється і підніметься Next.js фронтенд (на порту 3000).

Після того, як контейнери успішно запустяться, відкрийте у браузері: `http://localhost:3000`

## Локальний запуск (Без Docker)

Якщо ви хочете запустити проект локально для розробки:

**Бекенд:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Для Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Фронтенд:**
```bash
npm install
npm run dev
```

