const express = require("express");
const cors = require("cors");
const session = require('express-session');
const userRouter = require("./routes/user");
const orderRouter = require("./routes/order");
const adminRouter = require("./routes/admin");
const generalRouter = require("./routes/generalRoutes");
const worldline = require("./routes/worldline");


const adminAssignRoutes = require("./routes/adminassign"); // Import the new route
const action = require("./routes/action");
const bodyParser = require('body-parser'); // **Import body-parser**

const app = express();

app.use(session({
    secret: 'REYSS123', // Replace with a strong, random secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true } // Adjust cookie settings for production
  }));


// **ADD body-parser middleware setup HERE, BEFORE app.use(cors()) and other routes:**
app.use(bodyParser.urlencoded({ extended: false })); //  For parsing application/x-www-form-urlencoded
app.use(bodyParser.json());         // For parsing application/json


app.use(cors()); // Enable CORS -  Keep CORS setup AFTER body-parser

app.use(express.json()); //  You already have this line - you can REMOVE it, as bodyParser.json() does the same and is more standard for body parsing

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

const PORT = process.env.PORT || 8090;
app.listen(PORT, async () => {
    try {
        console.log("Connected to database");
    } catch (err) {
        console.log(err.message);
    }
    console.log(`Server is running on http://localhost:${PORT}`);
});