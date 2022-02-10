import defaultSettings from '../settings.json';
import Route from '../classes/route';

import type { GameMode } from '@typings/am4-api';
import type { AM4 } from '@typings/database';

interface ProfitOptions {
    gameMode: GameMode;
    fuelPrice?: number;
    co2Price?: number;
    reputation?: number;
    activity?: number;
    salaries?: {
        pilot: number;
        crew: number;
        engineer: number;
        tech: number;
    };
}

/**
 * A class containing static methods for planes
 */

export default class Plane {

    /**
     * Calculates the estimated profit of the plane
     * @param plane The raw plane data
     * @param options The profit options
     * @returns The estimated profit, expenses and income
     */

    static profit(plane: AM4.Plane, { gameMode, fuelPrice, co2Price, reputation, activity, salaries }: ProfitOptions) {
        fuelPrice ??= defaultSettings.fuelPrice;
        co2Price ??= defaultSettings.co2Price;
        activity ??= defaultSettings.activity;
        reputation ??= defaultSettings.reputation;
        salaries ??= defaultSettings.salaries;
        const distance = Math.round(activity * (gameMode === "Easy" ? plane.speed * 1.5 : plane.speed) / 4);
        const repMultiplier = reputation / 100;
        const staffExpenses = plane.staff.pilots * salaries.pilot + plane.staff.crew * salaries.crew + plane.staff.engineers * salaries.engineer + plane.staff.tech * salaries.tech;
        const A_checkExpenses = (gameMode === "Easy" ? plane.A_check.price / 2 : plane.A_check.price) / plane.A_check.time * activity;
        const fuelExpenses = (distance * plane.fuel * (fuelPrice / 1000)) * 4;
        const ticket = Route.ticket(distance, gameMode, plane.type === "vip");
        let income: number, expenses: number;
        if (plane.type === 'cargo') {
            const config = { 
                L: Math.trunc(Plane.heavyToLarge(plane.capacity * 0.80) * repMultiplier), 
                H: Math.trunc(plane.capacity * 0.20) 
            };
            income = ((config.L * ticket.L) + (config.H * ticket.H)) * 4;
            const co2Expenses = ((plane.co2 * distance * (plane.capacity / 500)) * (co2Price / 1000)) * 4;
            expenses = A_checkExpenses + fuelExpenses + staffExpenses + co2Expenses;
        } else {
            const config = {
                Y: Math.trunc(plane.capacity / 3 * repMultiplier),
                J: Math.trunc(plane.capacity / 3 / 2 * repMultiplier),
                F: Math.trunc(plane.capacity / 3 / 3 * repMultiplier)
            }
            income = ((config.Y * ticket.Y) + (config.J * ticket.J) + (config.F * ticket.F)) * 4;
            const co2Expenses = ((plane.co2 * distance * plane.capacity) * (co2Price / 1000)) * 4;
            expenses = A_checkExpenses + fuelExpenses + co2Expenses + staffExpenses;
        }
        return { 
            profit: Math.round(income - expenses), 
            income: Math.round(income), 
            expenses: Math.round(expenses)
        }
    }

    /**
     * Calculates the estimated resell price of the plane
     * @param plane The raw plane data
     * @param market The market percentage of the airport
     * @param hours The usage hours of the plane
     * @returns The estimated resell price
     */

    static resellPrice(plane: AM4.Plane, market: number, hours = 0) {
        const price = Math.round((plane.price - (2500 * hours)) * market / 100)
        return (price < plane.price * 0.10 ? Math.round(plane.price * 0.10) : price)
    }

    /**
     * Calculates the estimated share value growth per day
     * @param plane The raw plane data
     * @param options The options for the calculation
     * @returns The estimated share value growth
     */

    static estimatedShareValueGrowth(plane: AM4.Plane, options: ProfitOptions) {
        const { income, expenses } = Plane.profit(plane, options);
        const decrease = expenses / 40000000;
        const growth = income / 40000000;
        return growth - decrease;
    }

    /**
     * Calculates the estimated share value growth from purchasing the plane
     * @param price The price of the plane
     * @returns The share value from purchase
     */

    static estimatedShareValueFromPurchase = (price: number) => price / 66666666;

    /**
     * Converts the heavy load capacity to large load
     * @param capacity The capacity in heavy load
     * @returns The capacity in large load
     */

    static heavyToLarge = (capacity: number) => Math.round(capacity * (7 / 10));

    /**
     * Converts the large load capacity to heavy load
     * @param capacity The capacity in large load
     * @returns The capacity in heavy load
     */

    static largeToHeavy = (capacity: number) => Math.round(capacity * (10 / 7));
    
}