const mongoose = require('mongoose');
require('./models/users.model');
const express = require('express');
require('dotenv').config();
const port = process.env.PORT || 8000;
const usersRoute = require('./routes/index.js');
const cors = require('cors');
const swaggerUI = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');
const SchedulerService = require('./services/scheduler.service');

const isProduction = process.env.NODE_ENV === 'development';

const mongoURI = isProduction
	? process.env.MONGO_URI_PROD
	: process.env.MONGO_URI_LOCAL;

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
				url: `http://localhost:${port}`,
			},
		],
	},
	apis: ["./routes/*.js"],
};

const specs = swaggerJSDoc(options);

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

if (!mongoURI) {
	console.error('❌ Database URI is missing!');
	process.exit(1); // Stop the server if no URI is provided
}

mongoose
	.connect(mongoURI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(async () => {
		console.log(
			`✅ MongoDB connected (${isProduction ? 'production' : 'development'})`
		);
		try {
			const Book = require('./models/book.model');
			const backfilled = await Book.backfillSortKeys();
			if (backfilled) {
				console.log(`✅ Backfilled address sort keys on ${backfilled} books`);
			}
		} catch (err) {
			console.error('❌ Address sort key backfill failed:', err);
		}
	})
	.catch((err) => console.error('❌ MongoDB connection error:', err));

mongoose.Promise = global.Promise;

app.use('/', usersRoute);

app.listen(port, () => {
	console.log(`🚀 Server listening on http://localhost:${port}`);

	// Start scheduled jobs for email notifications
	if (process.env.ENABLE_EMAIL_SCHEDULER !== 'false') {
		SchedulerService.startAllJobs();
	}
});

module.exports = app;