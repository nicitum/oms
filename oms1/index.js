const express = require("express");
const cors = require("cors");
const session = require('express-session');
const userRouter = require("./routes/user");
const orderRouter = require("./routes/order");
const adminRouter = require("./routes/admin");
const generalRouter = require("./routes/generalRoutes");
const worldline = require("./routes/worldline");
const adminAssignRoutes = require("./routes/adminassign");
const action = require("./routes/action");
const bodyParser = require('body-parser');

const app = express();

// Configure CORS before other middleware
app.use(cors({
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(session({
    secret: 'APPU123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("Homepage");
});

app.use("/", userRouter);
app.use("/", orderRouter);
app.use("/", adminRouter);
app.use("/", generalRouter);
app.use("/",adminAssignRoutes);
app.use("/",action);
app.use("/",worldline);

app.get("/s", (req, res) => {
    res.send("Secured page.");
});

const PORT = process.env.PORT || 8091;
app.listen(PORT, async () => {
    try {
        console.log("Connected to database");
    } catch (err) {
        console.log(err.message);
    }
    console.log(`Server is running on http://localhost:${PORT}`);
});