require('dotenv').config();

module.exports ={ 
    PORT: process.env.PORT || 3000,
    WINDOW_SIZE_MS : process.env.WINDOW_SIZE_MS || 60 * 1000,
    MAX_REQUESTS: process.env.MAX_REQUESTS ||  5,
}