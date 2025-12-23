export const CONFIG = {
    anabotKey: process.env.ANABOT_KEY || ''
};

export const PROXIES = [
    { name: 'Direct', url: '', useRaw: true },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/get?url=', useRaw: false },
    { name: 'CORSProxy', url: 'https://corsproxy.io/?', useRaw: true }
];