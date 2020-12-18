import { IRequestGrip } from "@fanoutio/serve-grip";

declare module "express-serve-static-core" {
  // first, declare that we are adding a method to `Response` (the interface)
  export interface Request {
    grip: IRequestGrip;
  }
}
