/**
 * API route to handle hotel search with secure credential management using Axios
 * @param {Request} request - The incoming request object
 * @returns {Response} JSON response with hotel data or error
 */
import { NextResponse } from 'next/server';
import { sanitize } from 'isomorphic-dompurify';
import axios from 'axios';

// City to location_id mapping
const CITY_TO_LOCATION_ID = {
    'Paris': 1,
    'New York': 2,
    'California': 3,
    'Los Angeles': 5,
};

/**
 * GET handler for hotel search
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const city = sanitize(searchParams.get('city') || '');
    const checkin = sanitize(searchParams.get('checkin') || '');
    const checkout = sanitize(searchParams.get('checkout') || '');
    const adults = parseInt(sanitize(searchParams.get('adults') || '1'), 10);
    const children = parseInt(sanitize(searchParams.get('children') || '0'), 10);

    // Input validation
    if (!city || !checkin || !checkout || isNaN(adults) || isNaN(children)) {
        return NextResponse.json(
            { error: 'Missing or invalid required parameters' },
            { status: 400 }
        );
    }

    const locationId = CITY_TO_LOCATION_ID[city];
    if (!locationId) {
        return NextResponse.json(
            { error: 'Invalid city selected' },
            { status: 400 }
        );
    }

    try {
        const response = await axios.get(
            `https://staging.trektoo.com/api/hotel/search?location_id=${locationId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${Buffer.from(
                        `${process.env.API_USERNAME}:${process.env.API_PASSWORD}`
                    ).toString('base64')}`,
                },
                // Equivalent to Next.js fetch revalidate for caching
                next: { revalidate: 3600 }, // Cache for 1 hour (Next.js specific)
            }
        );

        // Sanitize API response data
        const sanitizedData = response.data.data.map((hotel) => ({
            ...hotel,
            title: sanitize(hotel.title),
            content: sanitize(hotel.content),
            image: sanitize(hotel.image),
        }));

        // Log successful request for monitoring
        console.info(`Hotel search completed for city: ${city}, results: ${response.data.total}`);

        return NextResponse.json(
            {
                total: response.data.total,
                total_pages: response.data.total_pages,
                data: sanitizedData,
            },
            {
                headers: {
                    'Content-Security-Policy': "default-src 'self';",
                    'X-Content-Type-Options': 'nosniff',
                    'Cache-Control': 'public, max-age=3600',
                },
            }
        );
    } catch (error) {
        console.error('Hotel search error:', {
            message: error.message,
            stack: error.stack,
            city,
            status: error.response?.status,
        });

        return NextResponse.json(
            { error: 'Failed to fetch hotels' },
            { status: error.response?.status || 500 }
        );
    }
}