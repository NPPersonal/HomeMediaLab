"use server";

const host = "http://localhost:3001";
const headers = { "Content-Type": "application/json" };

export const pauseTask = async (taskId: string) => {
  try {
    const url = new URL("/pause", host).href;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error(response.statusText);
    // console.log(await response.json());
  } catch (err) {
    console.error(err);
  }
};

export const resumeTask = async (taskId: string) => {
  try {
    const url = new URL("/resume", host).href;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error(response.statusText);
    // console.log(await response.json());
  } catch (err) {
    console.error(err);
  }
};

export const cancelTask = async (taskId: string) => {
  try {
    const url = new URL("/cancel", host).href;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error(response.statusText);
    // console.log(await response.json());
  } catch (err) {
    console.error(err);
  }
};

export const removeTaskFromCompleted = async (taskId: string) => {
  try {
    const url = new URL("/delete/from/completed", host).href;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error(response.statusText);
    // console.log(await response.json());
  } catch (err) {
    console.error(err);
  }
};

export const removeTaskFromCanceled = async (taskId: string) => {
  try {
    const url = new URL("/delete/from/canceled", host).href;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error(response.statusText);
    // console.log(await response.json());
  } catch (err) {
    console.error(err);
  }
};
