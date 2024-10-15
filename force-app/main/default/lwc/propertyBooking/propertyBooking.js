import { LightningElement, track, wire } from 'lwc';
import getAvailableProperties from '@salesforce/apex/PropertyController.getAvailableProperties';
import getAvailableBookingSlots from '@salesforce/apex/PropertyController.getAvailableBookingSlots';
import createBooking from '@salesforce/apex/PropertyController.createBooking';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class PropertyBooking extends LightningElement {
    selectedProperty;
    selectedSlot;
    @track error;
    @track slots = [];
    @track displayedSlots = [];
    slotBatchSize = 8;
    slotOffset = 0;

    @wire(getAvailableProperties) properties;

    @wire(getAvailableBookingSlots, { propertyId: '$selectedProperty' })
    wiredSlots({ data, error }) {
        if (data) {
            console.log('Available slots:', data);
            this.slots = data.map(slot => `${slot.start} to ${slot.end}`);
            this.error = undefined;
            this.displayedSlots = this.slots.slice(0, this.slotBatchSize); // Load initial batch
            console.log('Displayed slots initially:', this.displayedSlots);
        } else if (error) {
            this.error = error;
            this.slots = [];
        }
    }

    get propertyOptions() {
        return this.properties.data ? this.properties.data.map(property => {
            return { label: property.Name, value: property.Id };
        }) : [];
    }

    handlePropertyChange(event) {
        this.selectedProperty = event.detail.value;
        this.selectedSlot = null; 
        this.slotOffset = 0; 
        this.displayedSlots = []; // Reset displayed slots
        console.log('Property changed:', this.selectedProperty);
    }

    handleSlotSelection(event) {
        this.selectedSlot = event.target.dataset.slot;
        this.handleBooking();
    }

    handleBooking() {
        if (this.selectedProperty && this.selectedSlot) {
            const slot = this.slots[parseInt(this.selectedSlot)];
            const startDate = new Date(slot.slice(0, 10));
            const endDate = new Date(slot.slice(14, slot.length));

            createBooking({ propertyId: this.selectedProperty, startDate, endDate })
                .then(result => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Booking Status',
                            message: result,
                            variant: result.includes('successfully') ? 'success' : 'error',
                        })
                    );
                    if (result.includes('successfully')) {
                        refreshApex(this.slots);
                        refreshApex(this.properties);
                        refreshApex(this.wiredSlots);
                    }
                })
                .catch(error => {
                    this.error = error;
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error creating booking',
                            message: error.body.message,
                            variant: 'error',
                        })
                    );
                });
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Missing Information',
                    message: 'Please select a property and a date range to book.',
                    variant: 'warning',
                })
            );
        }
    }

    loadMoreSlots() {
        console.log('Loading more slots...');
        this.slotOffset += this.slotBatchSize;
        const nextSlots = this.slots.slice(this.slotOffset, this.slotOffset + this.slotBatchSize);
        console.log('Next slots to be loaded:', nextSlots);
        this.displayedSlots = [...this.displayedSlots, ...nextSlots];
        console.log('Displayed slots after loading more:', this.displayedSlots);
    }

    handleScroll(event) {
        const scrollArea = event.target;
        console.log('Scroll event fired');
        console.log('ScrollTop:', scrollArea.scrollTop);
        console.log('ClientHeight:', scrollArea.clientHeight);
        console.log('ScrollHeight:', scrollArea.scrollHeight);

        // Adjust the scroll condition to ensure proper detection
        if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 10) {
            console.log('Reached bottom, loading more slots...');
            this.loadMoreSlots();
        }
    }
}
