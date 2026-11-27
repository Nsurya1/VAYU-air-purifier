/**
 * @file telemetry_buffer.c
 * @brief SOCHI VAYU - Bounded Offline Telemetry Ring Buffer Implementation
 */

#include "telemetry_buffer.h"
#include <string.h>

#ifndef VAYU_TEST_HOST
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
static SemaphoreHandle_t s_mutex = NULL;
#define BUFFER_LOCK()   if (s_mutex) xSemaphoreTake(s_mutex, portMAX_DELAY)
#define BUFFER_UNLOCK() if (s_mutex) xSemaphoreGive(s_mutex)
#else
#define BUFFER_LOCK()
#define BUFFER_UNLOCK()
#endif

static vayu_telemetry_item_t s_ring[VAYU_BUFFER_MAX_ITEMS];
static uint16_t s_head = 0; // Points to oldest record
static uint16_t s_tail = 0; // Points to next write slot
static uint16_t s_count = 0;
static uint32_t s_dropped_count = 0;

void telemetry_buffer_init(void)
{
#ifndef VAYU_TEST_HOST
    if (s_mutex == NULL) {
        s_mutex = xSemaphoreCreateMutex();
    }
#endif
    BUFFER_LOCK();
    s_head = 0;
    s_tail = 0;
    s_count = 0;
    s_dropped_count = 0;
    memset(s_ring, 0, sizeof(s_ring));
    BUFFER_UNLOCK();
}

bool telemetry_buffer_push(const vayu_telemetry_item_t *item)
{
    if (item == NULL) return false;

    bool overwritten = false;
    BUFFER_LOCK();

    if (s_count >= VAYU_BUFFER_MAX_ITEMS) {
        // Buffer full: Advance head to discard the oldest item (FIFO overwrite)
        s_head = (s_head + 1) % VAYU_BUFFER_MAX_ITEMS;
        s_dropped_count++;
        overwritten = true;
    } else {
        s_count++;
    }

    s_ring[s_tail] = *item;
    s_tail = (s_tail + 1) % VAYU_BUFFER_MAX_ITEMS;

    BUFFER_UNLOCK();
    return !overwritten;
}

bool telemetry_buffer_pop(vayu_telemetry_item_t *out_item)
{
    if (out_item == NULL) return false;

    BUFFER_LOCK();
    if (s_count == 0) {
        BUFFER_UNLOCK();
        return false;
    }

    *out_item = s_ring[s_head];
    s_head = (s_head + 1) % VAYU_BUFFER_MAX_ITEMS;
    s_count--;

    BUFFER_UNLOCK();
    return true;
}

bool telemetry_buffer_peek(vayu_telemetry_item_t *out_item)
{
    if (out_item == NULL) return false;

    BUFFER_LOCK();
    if (s_count == 0) {
        BUFFER_UNLOCK();
        return false;
    }

    *out_item = s_ring[s_head];
    BUFFER_UNLOCK();
    return true;
}

uint16_t telemetry_buffer_count(void)
{
    BUFFER_LOCK();
    uint16_t count = s_count;
    BUFFER_UNLOCK();
    return count;
}

uint32_t telemetry_buffer_get_dropped_count(void)
{
    BUFFER_LOCK();
    uint32_t dropped = s_dropped_count;
    BUFFER_UNLOCK();
    return dropped;
}

void telemetry_buffer_clear(void)
{
    BUFFER_LOCK();
    s_head = 0;
    s_tail = 0;
    s_count = 0;
    BUFFER_UNLOCK();
}
