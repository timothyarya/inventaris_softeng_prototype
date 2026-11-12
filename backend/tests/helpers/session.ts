import request from "supertest";
import { app } from "../../src/app";

/** Pengguna yang sudah login: setiap request membawa cookie `token` miliknya. */
export class Session {
  constructor(
    readonly cookie: string,
    readonly user: { id: number; role: string; branch: { id: number; code: string } | null },
  ) {}

  get(path: string) {
    return request(app).get(`/api${path}`).set("Cookie", this.cookie);
  }
  post(path: string, body: object = {}) {
    return request(app).post(`/api${path}`).set("Cookie", this.cookie).send(body);
  }
  patch(path: string, body: object = {}) {
    return request(app).patch(`/api${path}`).set("Cookie", this.cookie).send(body);
  }
  delete(path: string) {
    return request(app).delete(`/api${path}`).set("Cookie", this.cookie);
  }
}

export const anonymous = () => request(app);

export async function login(email: string, password = "password123"): Promise<Session> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login ${email} gagal: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const header = res.headers["set-cookie"] as unknown as string[];
  const cookie = header.find((c) => c.startsWith("token="))!.split(";")[0]!;
  return new Session(cookie, res.body.data);
}

/** Akun seed (password `password123`). */
export const loginSeed = {
  owner: () => login("owner@softeng.local"),
  adminGudang: () => login("admingudang1@softeng.local"),
  adminGudang2: () => login("admingudang2@softeng.local"),
  pegawaiCb01: () => login("pegawaicabang1@softeng.local"),
  pegawaiCb02: () => login("pegawaicabang2@softeng.local"),
};
