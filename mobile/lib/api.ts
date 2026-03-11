import { API_BASE_URL } from "./firebase";
import { Platform } from "react-native";

export interface UploadResponse {
  jobId: string;
  status: "pending";
  createdAt: string;
}

export interface UploadError {
  error: string;
  dimensions?: { width: number; height: number };
}

/**
 * Upload an image to the backend API
 * @param imageUri - Local URI of the image to upload (file:// for native, data: for web)
 * @param language - Story language (ja or en)
 * @param idToken - Firebase ID token for authentication
 * @returns Upload response with jobId
 * @throws Error with user-friendly message
 */
export async function uploadImage(
  imageUri: string,
  language: "ja" | "en",
  idToken: string
): Promise<UploadResponse> {
  try {
    // Create FormData for multipart upload
    const formData = new FormData();

    if (Platform.OS === "web") {
      // Web: Convert data URL to Blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append("image", blob, "image.jpg");
    } else {
      // Native: Use file URI
      const filename = imageUri.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      // @ts-ignore - React Native FormData accepts this format
      formData.append("image", {
        uri: imageUri,
        name: filename,
        type,
      });
    }

    formData.append("language", language);

    // Make API request
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors with user-friendly messages
      const errorData = data as UploadError;
      throw new Error(errorData.error || "Upload failed");
    }

    return data as UploadResponse;
  } catch (error) {
    console.error("Upload error:", error);

    // Network errors
    if (error instanceof TypeError && error.message.includes("Network")) {
      throw new Error("Network error. Please check your connection and try again.");
    }

    // Re-throw with original message if it's already user-friendly
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to upload image. Please try again.");
  }
}

export interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "done" | "error";
  progress?: {
    stage: "analyzing" | "generating" | "illustrating" | "animating" | "narrating" | "composing";
    percentage: number;
  };
  result?: {
    title: string;
    videoUrl: string;
    storyText: string[];
  };
  error?: string;
  updatedAt: string;
}

/**
 * Get job status from the backend API
 * @param jobId - Job identifier
 * @param idToken - Firebase ID token for authentication
 * @returns Job status information
 */
export async function getJobStatus(
  jobId: string,
  idToken: string
): Promise<JobStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Job not found");
      }
      if (response.status === 403) {
        throw new Error("Access denied");
      }
      throw new Error("Failed to get job status");
    }

    return await response.json();
  } catch (error) {
    console.error("Status check error:", error);

    if (error instanceof TypeError && error.message.includes("Network")) {
      throw new Error("Network error. Please check your connection and try again.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to check status. Please try again.");
  }
}

export interface VideoUrls {
  videoUrl: string;
  downloadUrl: string;
  expiresAt: string;
}

/**
 * Get signed video URLs from the backend API
 * @param jobId - Job identifier
 * @param idToken - Firebase ID token for authentication
 * @returns Signed video and download URLs
 */
export async function getVideoUrls(
  jobId: string,
  idToken: string
): Promise<VideoUrls> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/video/${jobId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Video not found or not ready yet");
      }
      if (response.status === 403) {
        throw new Error("Access denied");
      }
      throw new Error("Failed to get video");
    }

    return await response.json();
  } catch (error) {
    console.error("Video fetch error:", error);

    if (error instanceof TypeError && error.message.includes("Network")) {
      throw new Error("Network error. Please check your connection and try again.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to get video. Please try again.");
  }
}
