// ALU Legal Companion API: server entry point
import app from './app.js';

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ALU Legal Companion API on :${port}`));
