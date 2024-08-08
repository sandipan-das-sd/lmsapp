require("dotenv").config();
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.service";
import cloudinary from "cloudinary";

// register user
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email already exist", 400));
      }
      
      const user: IRegistrationBody = {
        name,
        email,
        password,
      };

      const activationToken = createActivationToken(user);

      const activationCode = activationToken.activationCode;

      const data = { user: { name: user.name }, activationCode };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );
      
      try {
        await sendMail({
          email: user.email,
          subject: "Activate your account",
          template: "activation-mail.ejs",
          data,
        });

        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.email} to activate your account!`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );

  return { token, activationCode };
};

// activate user
interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });

      if (existUser) {
        return next(new ErrorHandler("Email already exist", 400));
      }
      const user = await userModel.create({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Login user
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;

      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// logout user
export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });
      const userId = req.user?._id || "";
      // console.log(req.user)
      redis.del(userId);
      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }

  
);

// update access token
// access token will expire soon (5m) but refresh token  expire (3d)
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      const message = "Could not refresh token";
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }
      const session = await redis.get(decoded.id as string);
         
      if (!session) {
        return next(
          new ErrorHandler("Please login for access this resources!", 400)
        );
      }
      
      const user = JSON.parse(session);

      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn: "1440m",
        }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn: "3d",
        }
      );

      req.user = user;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      await redis.set(user._id, JSON.stringify(user), "EX", 604800); // 7days
      res.status(200).json({
        status:"Success",
        accessToken,
      })

      return next();
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);



// get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("User ID not found", 400));
      }

      getUserById(userId, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);



// social auth

interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}

export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update user info
interface IUpdateUserInfo {
  name?: string;
  email?: string;
}


export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body as IUpdateUserInfo;
      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("User ID not found", 400));
      }

      const user = await userModel.findById(userId);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (email) {
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist) {
          return next(new ErrorHandler("Email Already Exists", 400));
        }
        user.email = email;
      }

      if (name) {
        user.name = name;
      }

      await user.save();

      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// update user password
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;

      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Please enter old and new password", 400));
      }

      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("User ID not found", 400));
      }

      const user = await userModel.findById(userId).select("+password");

      if (!user || user.password === undefined) {
        return next(new ErrorHandler("Invalid user", 400));
      }

      const isPasswordMatch = await user.comparePassword(oldPassword);

      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid old password", 400));
      }

      user.password = newPassword;

      await user.save();

      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);



// update profile picture

interface IUpdateProfilePicture {
  avatar: string;
}

export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body as IUpdateProfilePicture;

      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("User ID not found", 400));
      }

      const user = await userModel.findById(userId).select("+password");

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (avatar) {
        // Delete the old avatar if it exists
        if (user.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        // Upload the new avatar
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
        });

        // Update user avatar information
        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };

        await user.save();

        await redis.set(userId, JSON.stringify(user));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// get all users --- only for admin
export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update user role --- only for admin
export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body;
      const isUserExist = await userModel.findOne({ email });
      if (isUserExist) {
        const id = isUserExist._id;
        updateUserRoleService(res,id, role);
      } else {
        res.status(400).json({
          success: false,
          message: "User not found",
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Delete user --- only for admin
export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const user = await userModel.findById(id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      await user.deleteOne({ id });

      await redis.del(id);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// // Reset Password
// interface IPasswordReset {
//   resetToken: string;
//   newPassword: string;
// }

// interface IPasswordResetRequest {
//   email: string;
// }
// export const requestPasswordReset = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { email } = req.body as IPasswordResetRequest;

//       // Find the user by email
//       const user = await userModel.findOne({ email });
//       if (!user) {
//         return next(new ErrorHandler("User with this email does not exist", 400));
//       }

//       // Generate a reset token and set its expiration
//       const resetToken = crypto.randomBytes(32).toString('hex');
//       user.passwordResetToken = resetToken;
//       user.passwordResetTokenExpire = new Date(Date.now() + 3600000); // 1 hour
//       await user.save();

//       // Prepare data for the email content
//       const userName = user.name;
//       const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
//       const supportUrl = `${process.env.FRONTEND_URL}/support`;

//       // Directly create the HTML email content
//       const emailContent = `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//           <meta charset="UTF-8">
//           <meta name="viewport" content="width=device-width, initial-scale=1.0">
//           <title>Password Reset Request</title>
//           <style>
//             body {
//               margin: 0;
//               padding: 0;
//               min-width: 100%;
//               font-family: Arial, sans-serif;
//               font-size: 16px;
//               line-height: 1.5;
//               background-color: #fafafa;
//               color: #222222;
//             }
//             a {
//               color: #0070f3;
//               text-decoration: none;
//             }
//             .email-wrapper {
//               max-width: 600px;
//               margin: 0 auto;
//               background-color: #ffffff;
//               border-radius: 8px;
//               box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
//             }
//             .email-header {
//               background-color: #0070f3;
//               padding: 24px;
//               color: #ffffff;
//               text-align: center;
//             }
//             .email-body {
//               padding: 24px;
//             }
//             .button {
//               display: inline-block;
//               background-color: #0070f3;
//               color: #ffffff;
//               font-size: 16px;
//               font-weight: 700;
//               text-align: center;
//               text-decoration: none;
//               padding: 12px 24px;
//               border-radius: 4px;
//               margin-top: 10px;
//             }
//             .email-footer {
//               background-color: #f6f6f6;
//               padding: 24px;
//               text-align: center;
//               font-size: 14px;
//               color: #666666;
//             }
//           </style>
//         </head>
//         <body>
//           <div class="email-wrapper">
//             <div class="email-header">
//               <h1>Password Reset Request</h1>
//             </div>
//             <div class="email-body">
//               <p>Hello ${userName},</p>
//               <p>We received a request to reset your password for your SolviT account. If you did not request this change, please ignore this email.</p>
//               <p>To reset your password, please click the button below:</p>
//               <a href="${resetLink}" class="button">Reset Password</a>
//               <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
//               <p>${resetLink}</p>
//             </div>
//             <div class="email-footer">
//               <p>Thank you for using SolviT!</p>
//               <p>For any questions or support, please visit our <a href="${supportUrl}">support page</a>.</p>
//               <p>&copy; ${new Date().getFullYear()} SolviT. All rights reserved.</p>
//             </div>
//           </div>
//         </body>
//         </html>
//       `;

//       // Adjust to fit your sendMail function's API
//       try {
//         await sendMail({
//           to: user.email, // Typically, 'to' or 'recipient' might be used
//           subject: "Reset Your Password",
//           text: emailContent, // Use 'text' if 'html' is not supported
//           // Add any other required properties based on your `sendMail` implementation
//         });

//         res.status(200).json({
//           success: true,
//           message: `A password reset link has been sent to ${user.email}`,
//         });
//       } catch (error: any) {
//         return next(new ErrorHandler(error.message, 400));
//       }
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 400));
//     }
//   }
// );

// export const resetPassword = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { resetToken, newPassword } = req.body as IPasswordReset;

//       // Find the user by the reset token and check if the token has expired
//       const user = await userModel.findOne({
//         passwordResetToken: resetToken,
//         passwordResetTokenExpire: { $gt: Date.now() },
//       });

//       if (!user) {
//         return next(new ErrorHandler("Invalid or expired reset token", 400));
//       }

//       // Hash the new password before saving
//       user.password = await bcrypt.hash(newPassword, 10);
//       user.passwordResetToken = undefined;
//       user.passwordResetTokenExpire = undefined;
//       await user.save();

//       res.status(200).json({
//         success: true,
//         message: "Password has been successfully reset",
//       });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 400));
//     }
//   }
// );

