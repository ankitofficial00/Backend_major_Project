import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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

  // console.log(req.body);
  if (
    [fullName, email, password, username].some((field) => field?.trim === "")
  ) {
    throw new ApiError(400, "all fields are must be required");
  }

  // check the user is already exist or not
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  // console.log(existedUser);
  if (existedUser) {
    throw new ApiError(
      409,
      "user with this email , or username is already exist"
    );
  }

  // console.log(req.files);
  // multer provide a method req.files
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // console.log(avatarLocalPath);
  // console.log(coverImageLocalPath);

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

  console.log(createdUser);
  if (!createdUser) {
    throw new ApiError(
      500,
      "something went wrong while registering the new User"
    );
  }

  // user is created successfully

  // ApiResponse(202, createdUser, "new user successfully registered");

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "New account has been created"));
});

// generate the access token and refresh token

const generateAccessTokenAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "invalid access");
  }
};

const loginUser = asyncHandler(async (req, res) => {
  // get the user details from the  req.body
  // then login with username,  or email   -- check validation
  // find the user
  // password check

  // generate the access token and refresh token
  // send to the secure cookie
  // check the user is login successfully or not if it successfully then return response
  // otherwise throw an error

  // get the data from destructing
  const { email, password, username } = req.body;

  // validation of email or username

  if (!email && !username) {
    throw new ApiError(401, "both fields is empty");
  }

  if (!(email || username)) {
    throw new ApiError(404, "one field must br required");
  }
  // check the user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "user is not found");
  }

  // password check

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "password is incorrect ");
  }
  // token created

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshTokens(user._id);
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  // return the response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        202,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user is successfully login in to the application"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  // clear cookie data

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(202, {}, "user log out successfully !!! ??? "));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized access");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(404, "invalid refresh token");
    }

    // verified the token
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(
        402,
        "both refresh token are not the same so cannot access!!"
      );
    }

    // generate new Access token
    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshTokens(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          202,
          { accessToken, refreshToken: newRefreshToken },
          "access token is refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token ");
  }
});
export { registerUser, loginUser, logoutUser, refreshAccessToken };
