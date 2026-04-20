import 'dotenv/config';
import { createClient } from 'redis';

const redis = globalThis.redis_client ?? createClient({
    url : process.env.REDIS_URL
});


const connectRedis = async ()=>{
    if (!globalThis.redis_client)
    {
        redis.on('error', err => console.log('Redis Client Error', err));
        console.log("connecting redis: ");
        console.log("REDIS URL:", process.env.REDIS_URL);
        await redis.connect();
        globalThis.redis_client = redis;
    }
}

connectRedis();

export default redis;