import dotenv from "dotenv";
import connectDB from "./db/dbConnection.js";
dotenv.config({
  path: "./env",
});

connectDB();

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
