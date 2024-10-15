public with sharing class PropertyController {

    @AuraEnabled(cacheable=true)
    public static List<Property__c> getAvailableProperties() {
        return [SELECT Id, Name FROM Property__c];
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAvailableBookingSlots(Id propertyId) {
        List<Map<String, Object>> availableSlots = new List<Map<String, Object>>();

        // Get the current year and next year
        Integer currentYear = Date.today().year();
        Integer nextYear = currentYear + 1;

        // Define the booking period: June 1 - September 30
        Date startBookingPeriodCurrentYear = Date.newInstance(currentYear, 6, 1);
        Datetime startDateTime = (DateTime)startBookingPeriodCurrentYear;
        while (startDateTime.format('EEEE') != 'Saturday') {
            startDateTime = startDateTime.addDays(1);
        }

        startBookingPeriodCurrentYear = startDateTime.date();

        System.debug('startBookingPeriodCurrentYear ---- ' + startBookingPeriodCurrentYear);
        Date endBookingPeriodCurrentYear = Date.newInstance(currentYear, 9, 30);
        Date startBookingPeriodNextYear = Date.newInstance(nextYear, 6, 1);
        Date endBookingPeriodNextYear = Date.newInstance(nextYear, 9, 30);

        // Generate slots for both current and next year
        availableSlots.addAll(generateWeeklySlots(propertyId, startBookingPeriodCurrentYear, endBookingPeriodCurrentYear));
        availableSlots.addAll(generateWeeklySlots(propertyId, startBookingPeriodNextYear, endBookingPeriodNextYear));

        return availableSlots;
    }

    private static List<Map<String, Object>> generateWeeklySlots(Id propertyId, Date startDate, Date endDate) {
        List<Map<String, Object>> slots = new List<Map<String, Object>>();

        // Find the first Saturday on or after startDate
        Date nextSaturday = startDate.addDays(7);

        while (nextSaturday <= endDate) {
            Date slotStart = nextSaturday;
            Date slotEnd = nextSaturday.addDays(7);

            // Check if this slot is available
            List<Booking__c> overlappingBookings = [
                SELECT Id FROM Booking__c
                WHERE Property__c = :propertyId
                AND (
                    (StartDate__c < :slotEnd AND EndDate__c > :slotStart)
                )
            ];

            if (overlappingBookings.isEmpty()) {
                Map<String, Object> slot = new Map<String, Object>();
                slot.put('start', slotStart);
                slot.put('end', slotEnd);
                slots.add(slot);
            }

            // Move to the next week
            nextSaturday = nextSaturday.addDays(7);
        }

        return slots;
    }

    @AuraEnabled
    public static String createBooking(Id propertyId, Date startDate, Date endDate) {
        // Validate that end date is after start date
        if (startDate >= endDate) {
            return 'End date must be after the start date.';
        }

        // Check for existing bookings that overlap with the requested dates
        List<Booking__c> overlappingBookings = [
            SELECT Id FROM Booking__c
            WHERE Property__c = :propertyId
            AND (
                (StartDate__c < :endDate AND EndDate__c > :startDate)
            )
        ];

        if (!overlappingBookings.isEmpty()) {
            return 'This property is already booked for the selected period.';
        }

        // Create the booking
        Booking__c booking = new Booking__c();
        booking.Property__c = propertyId;
        booking.StartDate__c = startDate;
        booking.EndDate__c = endDate;
        insert booking;

        return 'Booking created successfully';
    }
}
