import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { IOrder } from "../models/order.Model";
import userModel from "../models/user.model";
import CourseModel, { ICourse } from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.Model";
import { getAllOrdersService, newOrder } from "../services/order.service";
import { redis } from "../utils/redis";
import { json } from "stream/consumers";
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// create order


export const createOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, payment_info } = req.body as IOrder;

      if (payment_info) {
        if ("id" in payment_info) {
          const paymentIntentId = payment_info.id;
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

          if (paymentIntent.status !== "succeeded") {
            return next(new ErrorHandler("Payment not authorized", 400));
          }
        }
      }

      if (!req.user) {
        return next(new ErrorHandler("User not authenticated", 401));
      }

      const user = await userModel.findById(req.user._id);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const course: ICourse | null = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      if (!payment_info) {
        return next(new ErrorHandler("Payment info is missing", 400));
      }

      const data: any = {
        courseId: course._id.toString(),
        userId: user._id.toString(),
        payment_info,
      };

      const mailData = {
        order: {
          _id: course._id.toString().slice(0, 6),
          name: course.name,
          tag: course.tags,
          price: course.price,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        },
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/order-confirmation.ejs"),
        { order: mailData }
      );

      try {
        if (user) {
          await sendMail({
            email: user.email,
            subject: "Order Confirmation",
            template: "order-confirmation.ejs",
            data: mailData,
          });
        }
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }

      user.courses.push({ courseId: course._id.toString() });
      await redis.set(req.user?._id, JSON.stringify(user))
      const userId = req.user._id?.toString();
      if (userId) {
        await redis.set(userId, JSON.stringify(user));
      } else {
        return next(new ErrorHandler("User ID is missing", 400));
      }

      await user.save();

      await NotificationModel.create({
        user: user._id,
        title: "New Order",
        message: `You have a new order from ${course.name}`,
      });

      course.purchased += 1;
      await course.save();

      newOrder(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get All orders --- only for admin
export const getAllOrders = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllOrdersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//  send stripe publishble key
export const sendStripePublishableKey = CatchAsyncError(
  async (req: Request, res: Response) => {
    res.status(200).json({
      publishablekey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  }
);

// new payment
export const newPayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myPayment = await stripe.paymentIntents.create({
        amount: req.body.amount,
        currency: "INR",
        description: "SolviT course services",
        metadata: {
          company: "SolviT",
        },
       
        payment_method_types: ['card'], // Specify valid payment method types here
        shipping: {
          name: "Harmik Lathiya",
          address: {
            line1: "218,Basudevpur Road Saratpally Shyamnagar",
            postal_code: "743127",
            city: "Kolkata",
            state: "WB",
            country: "INDIA",
          },
        },
      });
      console.log("Payment Intent Created:", myPayment);
      res.status(201).json({
        success: true,
        client_secret: myPayment.client_secret,
        payment_id: myPayment.id,
      });
    } catch (error: any) {
      console.error("Stripe error:", error); // Log the error for debugging
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


