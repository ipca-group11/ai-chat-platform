import { useMutation } from "@tanstack/react-query";
import { loginUser } from "../api/login";

export function useLogin() {
  return useMutation({
    mutationFn: loginUser,
  });
}
