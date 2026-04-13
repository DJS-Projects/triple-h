import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
	AuthJwtLoginError,
	RegisterRegisterError,
} from "@/app/clientService";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getErrorMessage(
	error: RegisterRegisterError | AuthJwtLoginError,
): string {
	let errorMessage = "An unknown error occurred";

	if (typeof error.detail === "string") {
		// If detail is a string, use it directly
		errorMessage = error.detail;
	} else if (typeof error.detail === "object" && "reason" in error.detail) {
		// If detail is an object with a 'reason' key, use that
		errorMessage = error.detail["reason"];
	}

	return errorMessage;
}
