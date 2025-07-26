import mongoose from 'mongoose';

export class Db {
  static db: mongoose.Connection;
  private static _instance: Db;

  public static init(): Db {
    if (!Db._instance) {
      Db._instance = new Db();
    }
    return Db._instance;
  }

  private constructor() {
    if (!process.env.MONGO_URL) {
      throw new Error('MONGO_URL environment variable is not set.');
    }
    mongoose.connect(process.env.MONGO_URL);
    Db.db = mongoose.connection;

    Db.db.on('error', console.error.bind(console, 'Connection error:'));
    Db.db.once('open', () => {
      console.log('Connected to MongoDB');
    });
  }
}
