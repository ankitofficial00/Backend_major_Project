import dotenv from "dotenv";
import connectDB from "./db/dbConnection.js";
import { app } from "./app.js";
dotenv.config({
  path: "./.env",
});

const port = process.env.PORT || 8080;
console.log(port);
connectDB()
  .then(() => {
    app.on("error", (err) => {
      console.log("server error ", err);
    });
    app.listen(port, () => {
      console.log(
        `server is running on  port ${port} and its link is http://localhost:${port}`
      );
    });
  })
  .catch((error) => {
    console.log("mongo Db connection failed  !!!!!", error);
  });

/*
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    app.on("error", (error) => {
      console.log("error", error);
      throw error;
    });

    app.listen(`${process.env.PORT}`, () => {
      console.log(`our server is running on ${process.env.PORT}`);
    });
  } catch (error) {
    console.log("Error", error);
    throw error;
  }
})();

*/
