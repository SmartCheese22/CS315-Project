import express from 'express';
import dotenv from 'dotenv';
import db from "./db/connection.js";
import cors from 'cors';
// Your new Placement Portal routes
import student from "./routes/student.js";
import company from "./routes/company.js";
import application from "./routes/application.js";
import offer from "./routes/offer.js";

dotenv.config();
const app = express();
app.use(cors());
const Port = process.env.PORT || 5000;

app.use(express.json());

// Test database connection and start server
db.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
        app.listen(Port, () => {
            console.log(`Server running on port http://localhost:${Port}`);
        });
    })
    .catch(err => {
        console.error('Database connection failed:', err);
        process.exit(1);
    });

// Use the routes
app.use('/student', student);
app.use('/company', company);
app.use('/application', application);
app.use('/offer', offer);
