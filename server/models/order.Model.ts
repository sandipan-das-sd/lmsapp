import mongoose, {Document,Model,Schema} from "mongoose";


// export interface IOrder extends Document{
//     courseId: string;
//     userId?:string;
//     payment_info: object;
// }
export interface IOrder extends Document {
    courseId: string;
    userId?: string;
    payment_info: {
        payment_id?: string; // Make sure to define the type here
        [key: string]: any; // Allow other properties
    };
}

const orderSchema = new Schema<IOrder>({
    courseId: {
     type: String,
     required: true
    },
    userId:{
        type: String,
        required: true
    },
    payment_info:{
        type: Object,
        // required: true
    },
},{timestamps: true});

const OrderModel: Model<IOrder> = mongoose.model('Order',orderSchema);

export default OrderModel;