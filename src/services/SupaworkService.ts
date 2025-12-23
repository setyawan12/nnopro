import crypto from 'node:crypto';
import { PROXIES, CONFIG } from '../constants';

export class SupaworkService {
    private iid: string = crypto.randomUUID();

    private async resilientRequest(url: string, method: string = 'GET', body: any = null, headers: any = {}) {
        for (const proxy of PROXIES) {
            try {
                const finalUrl = proxy.useRaw ? `${proxy.url}${url}` : `${proxy.url}${encodeURIComponent(url)}&_cache=${Date.now()}`;
                
                const response = await fetch(finalUrl, {
                    method,
                    headers: { ...headers, 'Accept': 'application/json' },
                    body: body ? (body instanceof Buffer ? body : JSON.stringify(body)) : null
                });

                if (response.ok) {
                    const text = await response.text();
                    try { return JSON.parse(text); } catch { return text; }
                }
            } catch (e) { continue; }
        }
        throw new Error("Proxy exhausted atau koneksi terputus.");
    }

    public async generate(
        imageBuffer: Buffer, 
        prompt: string, 
        aspectRatio: string,
        onProgress: (msg: string, step: number) => void
    ) {
        // Step 1: Turnstile
        onProgress("Bypass Turnstile Security", 1);
        const bRes = await this.resilientRequest(`https://anabot.my.id/api/tools/bypass?url=${encodeURIComponent('https://supawork.ai/id/nano-banana')}&siteKey=0x4AAAAAACBjrLhJyEE6mq1c&type=turnstile-min&apikey=${CONFIG.anabotKey}`);
        const tt = bRes.data?.result?.token;
        if (!tt) throw new Error("Captcha gagal.");

        // Step 2: Challenge
        onProgress("Handshake Session", 2);
        const ctRes = await this.resilientRequest('https://supawork.ai/supawork/headshot/api/sys/challenge/token', 'GET', null, {
            'X-Auth-Challenge': tt, 'X-Identity-Id': this.iid
        });
        const ct = ctRes.data?.challenge_token;

        // Step 3: Virtual Email
        onProgress("Mendaftarkan Akun Anonim", 3);
        const edata = await this.resilientRequest('https://api.internal.temp-mail.io/api/v3/email/new', 'POST', { min_name_length: 10 });
        const email = edata.email;
        const pass = "UserAI!12345";

        const regRes = await this.resilientRequest('https://supawork.ai/supawork/api/user/register', 'POST', {
            email, password: pass, register_code: '', credential: ''
        }, { 'X-Auth-Challenge': ct, 'X-Identity-Id': this.iid });

        // Step 4: OTP Scanning
        let code = "";
        for (let i = 0; i < 15; i++) {
            onProgress(`Scanning OTP (${i+1}/15)`, 4);
            await new Promise(r => setTimeout(r, 4500));
            const msgs = await this.resilientRequest(`https://api.internal.temp-mail.io/api/v3/email/${email}/messages`);
            if (msgs?.[0]) {
                const match = msgs[0].body_text.match(/\d{4}/);
                if (match) { code = match[0]; break; }
            }
        }
        if (!code) throw new Error("OTP tidak ditemukan (Timeout).");

        // Step 5: Verification & Login
        onProgress("Verifikasi Akun", 5);
        await this.resilientRequest('https://supawork.ai/supawork/api/user/register/code/verify', 'POST', {
            email, password: pass, register_code: code, credential: regRes.data.credential, route_path: '/nano-banana'
        }, { 'X-Auth-Challenge': ct, 'X-Identity-Id': this.iid });

        const ldata = await this.resilientRequest('https://supawork.ai/supawork/api/user/login/password', 'POST', { email, password: pass }, { 'X-Auth-Challenge': ct, 'X-Identity-Id': this.iid });
        const token = ldata.data?.token;

        // Step 6: OSS Upload
        onProgress("Mengunggah Gambar", 6);
        const ossRes = await this.resilientRequest(`https://supawork.ai/supawork/headshot/api/sys/oss/token?f_suffix=png&get_num=1&unsafe=1`, 'GET', null, {
            'Authorization': token, 'X-Identity-Id': this.iid
        });
        const oss = ossRes.data[0];
        await fetch(oss.put, { method: 'PUT', body: imageBuffer, headers: { 'Content-Type': 'image/png' } });

        // Step 7: Generation
        onProgress("Inisialisasi AI Nano Banana", 7);
        await this.resilientRequest('https://supawork.ai/supawork/headshot/api/media/image/generator', 'POST', {
            identity_id: this.iid, aigc_app_code: 'image_to_image_generator', model_code: 'google_nano_banana',
            custom_prompt: prompt, aspect_ratio: aspectRatio, image_urls: [oss.get], currency_type: 'gold'
        }, { 'Authorization': token, 'X-Auth-Challenge': ct, 'X-Identity-Id': this.iid });

        // Step 8: Polling
        for (let i = 0; i < 40; i++) {
            onProgress(`AI Sedang Menggambar (${i+1}/40)`, 8);
            await new Promise(r => setTimeout(r, 5000));
            const listRes = await this.resilientRequest(`https://supawork.ai/supawork/headshot/api/media/aigc/result/list/v1?page_no=1&page_size=10&identity_id=${this.iid}`, 'GET', null, {
                'Authorization': token, 'X-Identity-Id': this.iid
            });
            if (listRes?.data?.list?.[0]) {
                const item = listRes.data.list[0];
                if (item.status === 1 && item.list[0]?.url[0]) return { imageUrl: item.list[0].url[0] };
            }
        }
        throw new Error("Render timeout.");
    }
}