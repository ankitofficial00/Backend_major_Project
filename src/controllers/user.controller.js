import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandler(async (req, res) => {
  // logic of user registered
  // get the user details from the frontend, postman
  // validation checked correct string,format and empty string
  // checked the user is already exist or not if it exist then user login the application
  //   check the images , avatar
  // upload the images to cloudinary also avatar
  // check that avatar is successfully uploaded or not
  //    create the user object entry in db
  // remove the password and refresh token from the response
  // if the user is successfully registered the return response
  // otherwise show error message

  // destructuring of data

  const { fullName, email, password, username } = req.body;
  if (
    [fullName, email, password, username].some((field) => field?.trim === "")
  ) {
    throw new ApiError(400, "all fields are must be required");
  }

  // format of email
  if (!email.includes("@")) {
    throw new ApiError(400, "email must have proper format");
  }

  // check the user is already exist or not
  const existedUser = User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(
      409,
      "user with this email , or username is already exist"
    );
  }

  // multer provide a method req.files
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  // then check avatarLocalPath is present or not
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file must be required");
  }
  //   upload the files to the cloudinary

  // avatar file uploaded
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // upload the coverImage to cloudniary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "avatar files is not uploaded");
  }

  // create the object for entry in the database

  const user = await User.create({
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || " ",
    username: username.toLowerCase(),
    fullName,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(
      500,
      "something went wrong while registering the new User"
    );
  }

  // user is created successfully

  // ApiResponse(202, createdUser, "new user successfully registered");
  return res
    .status(202)
    .json(new ApiResponse(200, createdUser, "New account has been created"));
});

export { registerUser };
