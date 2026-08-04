// src/redux/store.ts
import { configureStore } from "@reduxjs/toolkit";

import { apiSlice } from "./api-slice";
import authReducer from "./auth/auth-slice";

export const makeStore = () =>
  configureStore({
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
