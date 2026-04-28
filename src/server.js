const app = require("./app");
const env = require("./config/env");

app.listen(env.port, () => {
  console.log(`Server berjalan di http://localhost:${env.port}`);
});
