-- Atomic bid script
-- KEYS[1] = auction:{id}:state
-- KEYS[2] = auction:{id}:ranking
-- ARGV[1] = bid amount (cents)
-- ARGV[2] = user ID
-- ARGV[3] = current timestamp (ms)
-- ARGV[4] = auto extend seconds
-- ARGV[5] = increment amount (cents)
-- ARGV[6] = ceiling price (cents), 0 = no ceiling

local current_price = tonumber(redis.call('HGET', KEYS[1], 'current_price'))
local end_time = tonumber(redis.call('HGET', KEYS[1], 'end_time'))
local status = redis.call('HGET', KEYS[1], 'status')
local increment = tonumber(ARGV[5])
local new_bid = tonumber(ARGV[1])
local now = tonumber(ARGV[3])
local extend_sec = tonumber(ARGV[4])
local ceiling = tonumber(ARGV[6])

-- Check auction is active
if status ~= 'ACTIVE' and status ~= 'EXTENDED' then
    return cjson.encode({code = -2, msg = "auction_not_active"})
end

-- Check auction not expired
if now > end_time then
    return cjson.encode({code = -3, msg = "auction_ended"})
end

-- Validate bid amount
if new_bid < current_price + increment then
    return cjson.encode({code = -1, msg = "bid_too_low", current_price = current_price})
end

-- Check ceiling price
local hit_ceiling = false
if ceiling > 0 and new_bid >= ceiling then
    new_bid = ceiling
    hit_ceiling = true
end

-- Update bid state
redis.call('HSET', KEYS[1], 'current_price', new_bid)
redis.call('HSET', KEYS[1], 'winner_id', ARGV[2])
redis.call('HINCRBY', KEYS[1], 'bid_count', 1)
redis.call('ZADD', KEYS[2], new_bid, ARGV[2])

-- Calculate extension
local extended = false
local new_end_time = end_time
local remaining = end_time - now

if not hit_ceiling and remaining > 0 and remaining <= extend_sec * 1000 then
    new_end_time = now + extend_sec * 1000
    redis.call('HSET', KEYS[1], 'end_time', new_end_time)
    redis.call('HSET', KEYS[1], 'status', 'EXTENDED')
    extended = true
end

if hit_ceiling then
    redis.call('HSET', KEYS[1], 'status', 'COMPLETED')
end

local bid_count = tonumber(redis.call('HGET', KEYS[1], 'bid_count'))
local rank = redis.call('ZREVRANK', KEYS[2], ARGV[2])
if rank then
    rank = rank + 1
end

return cjson.encode({
    code = 1,
    extended = extended,
    hit_ceiling = hit_ceiling,
    new_end_time = new_end_time,
    final_price = new_bid,
    bid_count = bid_count,
    rank = rank
})
