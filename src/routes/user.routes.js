import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwtUser } from "./../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),

  registerUser
);

router.route("/login").post(loginUser);

// secured routes
router.route("/logout").post(verifyJwtUser, logoutUser);
router.route("refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJwtUser, changeCurrentPassword);
router.route("/current-user").get(verifyJwtUser, getCurrentUser);
router.route("/update-account").patch(verifyJwtUser, updateAccountDetails);
router
  .route("/avatar")
  .patch(verifyJwtUser, upload.single("avatar"), updateUserAvatar);

router
  .route("/cover-image")
  .patch(verifyJwtUser, upload.single("coverImage"), updateUserCoverImage);
router.route("/c/:username").get(verifyJwtUser, getUserChannelProfile);
router.route("/history").get(verifyJwtUser, getWatchHistory);
export default router;
