CREATE TABLE IF NOT EXISTS public.book
(
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(13) NOT NULL,
    rating NUMERIC(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
    date_read DATE NOT NULL CHECK (date_read <= CURRENT_DATE),
    notes TEXT
);