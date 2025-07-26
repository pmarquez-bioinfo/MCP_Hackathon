import mongoose from "mongoose";
const { Schema, model } = mongoose;

const backgroundSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    imgUrl: {
      type: String,
      required: true, // URL of the background image
    },
    name: {
      type: String,
      required: false, // Name of the background
      default: "Default Background",
    },
  },
  {
    versionKey: false,
  }
);

export const Backgrounds = model("background", backgroundSchema);
