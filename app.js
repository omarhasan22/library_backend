const mongoose = require('mongoose');
require('./models/users.model')
const express = require('express');
require('dotenv').config();
const port = process.env.PORT || "8000";
const usersRoute = require('./routes/index.js');
const cors = require('cors');
const swaggerUI = require('swagger-ui-express')
const swaggerJSDoc = require('swagger-jsdoc')
const path = require('path');

const app = express();

const options = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "Mongo CRUD APIs",
			version: "1.0.0",
			description: "Mongo CRUD APIs",
		},
		servers: [
			{
				url: "http://localhost:8000",
			},
		],
	},
	apis: ["./routes/*.js"],
};

const specs = swaggerJSDoc(options);

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use(cors())
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production';
// const dbURI = isProduction ? process.env.MONGO_URI_PROD : process.env.MONGO_URI_LOCAL;
const dbURI = process.env.MONGO_URI_PROD;
console.log(`Using database URI: ${dbURI}`);
console.log(process.env.MONGO_URI_PROD);

if (!dbURI) {
	console.error('❌ Database URI is missing!');
	process.exit(1); // Stop the server if no URI is provided
}

mongoose
	.connect('mongodb+srv://omarhasan22:81195404OMAR@cluster0.e47czbw.mongodb.net/myLibrary?retryWrites=true&w=majority', {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => console.log(`✅ MongoDB connected (${isProduction ? 'production' : 'development'})`))
	.catch((err) => console.error('❌ MongoDB connection error:', err));

mongoose.Promise = global.Promise;

app.use('/', usersRoute);

app.listen(port, () => {
	// console.log(`Listening to requests on http://localhost:${port}`);
});

module.exports = app;