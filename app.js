require('dotenv').config();
const mongoose = require('mongoose');
require('./models/users.model');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const swaggerUI = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');
const usersRoute = require('./routes/index.js');
const SchedulerService = require('./services/scheduler.service');

const port = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === 'production';

const mongoURI = isProduction
	? process.env.MONGO_URI_PROD
	: process.env.MONGO_URI_LOCAL;

if (!mongoURI) {
	console.error('❌ Database URI is missing!');
	process.exit(1); // Stop the server if no URI is provided
}

// Keep Mongoose 6 query semantics explicit (and silence the strictQuery deprecation warning).
mongoose.set('strictQuery', true);

const app = express();

// Behind Render's (or any) reverse proxy, so req.ip is the real client IP for rate limiting.
// Set TRUST_PROXY=0 when running without a proxy.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

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

// gzip responses: the book list, /people (~1.2 MB of Arabic JSON) and exports shrink several times over.
app.use(compression());

// CORS_ORIGINS="https://a.example,https://b.example" restricts browser access to those origins.
// When unset, any origin is allowed (previous behaviour).
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));
// Uploaded covers get unique timestamped names, so browsers can cache them.
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d' }));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

mongoose
	.connect(mongoURI)
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

app.use('/', usersRoute);

// Unknown routes -> JSON 404 (instead of Express's HTML page).
app.use((req, res) => {
	res.status(404).json({ error: 'Not found' });
});

// Last-resort error handler: malformed JSON, upload errors, and anything thrown past a controller.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	const status = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
	if (status >= 500) console.error('Unhandled error:', err);
	res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

app.listen(port, () => {
	console.log(`🚀 Server listening on http://localhost:${port}`);

	// Start scheduled jobs for email notifications
	if (process.env.ENABLE_EMAIL_SCHEDULER !== 'false') {
		SchedulerService.startAllJobs();
	}
});

module.exports = app;
