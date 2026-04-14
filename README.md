# 📚 Library Management System (CLI Based)

A **Command-Line Interface (CLI)** based Library Management System using **Node.js**, **Express**, and **MySQL**. It allows users to view, issue, return books, and check fines via a terminal-based interface.

---

## ✅ Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v14 or higher) – [Install Node.js](https://nodejs.org/)
- **MySQL** Server – [Install MySQL](https://dev.mysql.com/downloads/)

---

## 📁 Folder Structure

```
LibraryManagmentSystem/
├── data.sql               # SQL script to initialize the database
├── package.json           # Project metadata and dependencies
├── client/
│   └── client.js          # CLI interface to interact with the system
├── server/
│   ├── server.js          # Express server entry point
│   ├── db/
│   │   └── connection.js  # MySQL database connection
│   ├── routes/
│   │   ├── book.js        # Book operations
│   │   ├── manager.js     # Manager functionalities
│   │   └── user.js        # User authentication and interactions
│   └── utils/
│       ├── mailer.js      # Email notifications
│       └── otpService.js  # OTP generation and validation
```

---

## 🛠️ Setup Instructions

### 1. Clone the Repository
If not already done:

```bash
git clone https://github.com/RushikeshChary/LibraryManagementSystem.git
cd LibraryManagmentSystem
```


### 2. Install Dependencies

Install the required packages:

```bash
npm install
```

---

### 3. Configure Environment Variables

Create a `.env` file inside the `server/` folder:

```bash
cd server
touch .env
```

Then open the `.env` file and add:

```env
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=library_management_system

EMAIL=your_email@gmail.com
EMAIL_PASSWORD=your_password
```

> Replace the placeholder values with your actual MySQL and email credentials.

---

### 4. Set Up MySQL Database

Run the following commands to create and populate the database:

```bash
mysql -u your_mysql_user -p < ../data.sql
```

---

### 5. Start the Backend Server

Start the Express backend server:

```bash
node server.js
```

> The backend will be running on `http://localhost:8080` or at port specified in your `.env` file.

---

### 6. Run the CLI Client

In a new terminal window/tab, run:

```bash
cd ../client
node client.js
```

This will launch the command-line interface for interacting with the system.

---

✅ You’re all set!  
Use the CLI to log in, view and manage books, issue/return books, and check fines.

---
