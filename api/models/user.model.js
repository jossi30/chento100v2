import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default:
        'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
    },
    // 1. isAdmin boolean field (default: false)
    isAdmin: {
      type: Boolean,
      default: false,
      set: function (val) {
        if (val === true) this.role = 'admin';
        return val;
      },
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      set: function (val) {
        if (val === 'admin') this.isAdmin = true;
        return val;
      },
    },
  },
  { timestamps: true }
);

if (mongoose.models && mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model('User', userSchema);

export default User;
