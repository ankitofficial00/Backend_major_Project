import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

import mongoose from "mongoose";

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

// change the current password

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(202, {}, "user change the password successfully !! ")
    );
});

// get the current user

const getCurrentUser = asyncHandler(async (req, res) => {
  // find the user

  return res
    .status(200)
    .json(
      new ApiResponse(202, req.user, "current user fetched Successfully !! ")
    );
});

const changeAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(202, user, "Account Details updated successfully"));
});

// change the avatar file

const changeUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is missing ");
  }

  /// upload to cloudinary server
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading the avatar file ");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(202, user, "Avatar file updates successfully !!!"));
});

const changeUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "cover image file is missing ");
  }

  /// upload to cloudinary server
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading the cover Image file ");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(202, user, "coverImage is updated successfully !!!"));
});

// advanced part of this project // mongo db aggregated pipeline
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const username = req.params;

  if (!username?.trim()) {
    throw new ApiError(404, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        email: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);

  // log the value of channel
  console.log(channel);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not found so try again !!");
  }

  // output of aggregation is in  array  and array contain the object

  return channel; // output in array data types

  // return the output in the form objects array so we can easily apply methods on the output
  return res
    .status(200)
    .json(
      new ApiResponse(202, channel[0]),
      "User channel Profile Fetched Successfully "
    );
});

// now we store the watch history of the user

const getWatchHistory = asyncHandler(async (req, res) => {
  // req.user._id // it not get the actual object id of mongo db data base it only contain the string that is internally converted by mongoose into object id

  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id), // convert the normal string id into the object id
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        202,
        user[0].watchHistory,
        "watch history fetched successfully !!"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  changeAccountDetails,
  changeUserAvatar,
  changeUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
