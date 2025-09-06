// import jwt from 'jsonwebtoken';
// import { Request, Response, NextFunction } from 'express';

// interface UserPayload {
//   id: string;
//   email: string;
// }

// // we are telling typescript that inside of the Express project find the interface
// // of Request that is already inside there, take that interface to add additional properties to it
// declare global {
//   namespace Express {
//     interface Request {
//       currentUser?: UserPayload;
//     }
//   }
// }

// export const currentUser = (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   if (!req.session?.jwt) {
//     return next();
//   }

//   try {
//     const payload = jwt.verify(
//       req.session.jwt,
//       process.env.JWT_SECRET_KEY!,
//     ) as UserPayload;
//     req.currentUser = payload;
//   } catch (error) {
//     res.send({ currentUser: null });
//   }

//   next();
// };
