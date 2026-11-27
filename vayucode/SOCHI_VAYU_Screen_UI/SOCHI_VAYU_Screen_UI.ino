#include <Arduino.h>
#include <LovyanGFX.hpp>
#include <lvgl.h>

// =========================================================================
// 1. LOVYANGFX DISPLAY & CAPACITIVE TOUCH (ST7796S 480x320 + FT6336U)
// =========================================================================
class LGFX : public lgfx::LGFX_Device {
  lgfx::Panel_ST7796  _panel_instance;
  lgfx::Bus_SPI       _bus_instance;
  lgfx::Light_PWM     _light_instance;
  lgfx::Touch_FT5x06  _touch_instance; // Compatible with FT6336U

public:
  LGFX(void) {
    { // SPI Bus Config
      auto cfg = _bus_instance.config();
      cfg.spi_host    = SPI2_HOST;
      cfg.spi_mode    = 0;
      cfg.freq_write  = 40000000; // 40 MHz high-speed SPI
      cfg.freq_read   = 16000000;
      cfg.spi_3wire   = false;
      cfg.use_lock    = true;
      cfg.dma_channel = SPI_DMA_CH_AUTO;
      cfg.pin_sclk    = 12; // SCK
      cfg.pin_mosi    = 11; // MOSI
      cfg.pin_miso    = -1; // Unused
      cfg.pin_dc      = 13; // DC/RS
      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    { // Panel Config (480x320 Landscape)
      auto cfg = _panel_instance.config();
      cfg.pin_cs           = 10; // CS
      cfg.pin_rst          = 14; // RST
      cfg.pin_busy         = -1;
      cfg.panel_width      = 320;
      cfg.panel_height     = 480;
      cfg.offset_x         = 0;
      cfg.offset_y         = 0;
      cfg.offset_rotation  = 1;  // Landscape orientation
      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits  = 1;
      cfg.readable         = false;
      cfg.invert           = false; // Set true if colors look inverted
      cfg.rgb_order        = false;
      cfg.dlen_16bit       = false;
      cfg.bus_shared       = false;
      _panel_instance.config(cfg);
    }

    { // Backlight PWM Configuration
      auto cfg = _light_instance.config();
      cfg.pin_bl      = 21; // Backlight pin
      cfg.invert      = false;
      cfg.freq        = 44100;
      cfg.pwm_channel = 7;
      _light_instance.config(cfg);
      _panel_instance.setLight(&_light_instance);
    }

    { // Capacitive Touch Configuration (I2C)
      auto cfg = _touch_instance.config();
      cfg.x_min           = 0;
      cfg.x_max           = 479;
      cfg.y_min           = 0;
      cfg.y_max           = 319;
      cfg.pin_int         = 4;   // CTP_INT
      cfg.bus_shared      = true;
      cfg.offset_rotation = 1;
      cfg.i2c_port        = 0;
      cfg.i2c_addr        = 0x38; // FT6336U default address
      cfg.pin_sda         = 8;   // CTP_SDA
      cfg.pin_scl         = 9;   // CTP_SCL
      cfg.freq            = 400000;
      _touch_instance.config(cfg);
      _panel_instance.setTouch(&_touch_instance);
    }

    setPanel(&_panel_instance);
  }
};

LGFX tft;

// =========================================================================
// 2. CUBIC AM1008W SENSOR INTERFACE
// =========================================================================
#define SENSOR_RX_PIN 18
#define SENSOR_TX_PIN 17

// CUBIC AM1008W Commands
const uint8_t POLL_CMD[5]        = {0x11, 0x02, 0x01, 0x01, 0xEB}; // Standard Read Measurement
const uint8_t POLL_CMD_ALT[5]    = {0x11, 0x02, 0x01, 0x00, 0xEC}; // Alt Read
const uint8_t CMD_CONTINUOUS[6]  = {0x11, 0x03, 0x0D, 0xFF, 0xFF, 0xE1}; // Continuous mode
const uint8_t CMD_DYNAMIC[5]     = {0x11, 0x02, 0x06, 0x01, 0xE6}; // Dynamic particle mode
uint8_t rxBuf[64];

struct SensorData {
  uint16_t co2  = 0;
  uint16_t pm25 = 0;
  float    temp = 0.0;
  float    hum  = 0.0;
  uint16_t voc  = 0;
  bool     connected = false;
  unsigned long lastValidPacketMs = 0;
} vayuData;

// =========================================================================
// 3. LVGL DISPLAY BUFFERS & UI WIDGET DECLARATIONS
// =========================================================================
static const uint32_t screenWidth  = 480;
static const uint32_t screenHeight = 320;
static lv_disp_draw_buf_t draw_buf;
static lv_color_t *buf1;

// Tabview Controller
lv_obj_t *tabview;
lv_obj_t *tab_live, *tab_analytics, *tab_settings;

// Live Monitor Page Widgets
lv_obj_t *hero_card;
lv_obj_t *lbl_bada_emoji;
lv_obj_t *lbl_air_status;
lv_obj_t *lbl_status_desc;
lv_obj_t *lbl_aqi_num;
lv_obj_t *arc_aqi_ring;
lv_obj_t *lbl_pm25_val, *lbl_voc_val, *lbl_temp_val, *lbl_hum_val, *lbl_co2_val;
lv_obj_t *lbl_global_status;

// Data Analytics Page Widgets
lv_obj_t *chart_history;
lv_chart_series_t *ser_co2_hist;
lv_chart_series_t *ser_pm25_hist;

// Settings Page Widgets
lv_obj_t *slider_brightness;
lv_obj_t *lbl_brightness_val;

void my_disp_flush(lv_disp_drv_t *disp, const lv_area_t *area, lv_color_t *color_p) {
  uint32_t w = (area->x2 - area->x1 + 1);
  uint32_t h = (area->y2 - area->y1 + 1);
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.writePixels((lgfx::rgb565_t *)&color_p->full, w * h);
  tft.endWrite();
  lv_disp_flush_ready(disp);
}

void my_touchpad_read(lv_indev_drv_t *indev_driver, lv_indev_data_t *data) {
  uint16_t touchX, touchY;
  bool touched = tft.getTouch(&touchX, &touchY);
  if (!touched) {
    data->state = LV_INDEV_STATE_REL;
  } else {
    data->state = LV_INDEV_STATE_PR;
    data->point.x = touchX;
    data->point.y = touchY;
  }
}

static void brightness_slider_cb(lv_event_t * e) {
  lv_obj_t * slider = lv_event_get_target(e);
  int val = (int)lv_slider_get_value(slider);
  tft.setBrightness(val);
  lv_label_set_text_fmt(lbl_brightness_val, "%d%%", (val * 100) / 255);
}

static void back_to_live_btn_cb(lv_event_t * e) {
  if (tabview) {
    lv_tabview_set_act(tabview, 0, LV_ANIM_ON);
  }
}

static void next_tab_settings_cb(lv_event_t * e) {
  if (tabview) {
    lv_tabview_set_act(tabview, 2, LV_ANIM_ON);
  }
}

static void prev_tab_analytics_cb(lv_event_t * e) {
  if (tabview) {
    lv_tabview_set_act(tabview, 1, LV_ANIM_ON);
  }
}

// Helper to create clean KPI Cards
lv_obj_t* create_kpi_card(lv_obj_t *parent, int x, int y, int w, int h, const char* title, const char* unit, lv_color_t accent) {
  lv_obj_t *card = lv_obj_create(parent);
  lv_obj_set_pos(card, x, y);
  lv_obj_set_size(card, w, h);
  lv_obj_set_style_bg_color(card, lv_color_hex(0x131C31), 0);
  lv_obj_set_style_border_color(card, lv_color_hex(0x23314D), 0);
  lv_obj_set_style_border_width(card, 1, 0);
  lv_obj_set_style_radius(card, 10, 0);
  lv_obj_set_style_pad_all(card, 8, 0);
  lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);

  // Left vertical accent bar
  lv_obj_t *bar = lv_obj_create(card);
  lv_obj_set_pos(bar, 0, 4);
  lv_obj_set_size(bar, 4, h - 22);
  lv_obj_set_style_bg_color(bar, accent, 0);
  lv_obj_set_style_border_width(bar, 0, 0);

  lv_obj_t *lbl_t = lv_label_create(card);
  lv_label_set_text(lbl_t, title);
  lv_obj_set_style_text_color(lbl_t, lv_color_hex(0x94A3B8), 0);
  lv_obj_set_style_text_font(lbl_t, &lv_font_montserrat_12, 0);
  lv_obj_set_pos(lbl_t, 12, 2);

  lv_obj_t *lbl_v = lv_label_create(card);
  lv_label_set_text(lbl_v, "--");
  lv_obj_set_style_text_color(lbl_v, lv_color_hex(0xFFFFFF), 0);
  lv_obj_set_style_text_font(lbl_v, &lv_font_montserrat_18, 0);
  lv_obj_set_pos(lbl_v, 12, 24);

  lv_obj_t *lbl_u = lv_label_create(card);
  lv_label_set_text(lbl_u, unit);
  lv_obj_set_style_text_color(lbl_u, lv_color_hex(0x64748B), 0);
  lv_obj_set_style_text_font(lbl_u, &lv_font_montserrat_10, 0);
  lv_obj_align(lbl_u, LV_ALIGN_BOTTOM_RIGHT, -4, -2);

  return lbl_v;
}

// =========================================================================
// 4. MULTI-PAGE DASHBOARD ARCHITECTURE
// =========================================================================
void build_vayu_dashboard() {
  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x0B0F19), 0);

  // Top Status Bar (Height: 28px)
  lv_obj_t *hdr = lv_obj_create(scr);
  lv_obj_set_pos(hdr, 6, 4);
  lv_obj_set_size(hdr, 468, 28);
  lv_obj_set_style_bg_color(hdr, lv_color_hex(0x131C31), 0);
  lv_obj_set_style_border_color(hdr, lv_color_hex(0x23314D), 0);
  lv_obj_set_style_border_width(hdr, 1, 0);
  lv_obj_set_style_radius(hdr, 6, 0);
  lv_obj_set_style_pad_all(hdr, 4, 0);
  lv_obj_clear_flag(hdr, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *lbl_brand = lv_label_create(hdr);
  lv_label_set_text(lbl_brand, "VAYU");
  lv_obj_set_style_text_color(lbl_brand, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_brand, &lv_font_montserrat_14, 0);
  lv_obj_align(lbl_brand, LV_ALIGN_LEFT_MID, 6, 0);

  lbl_global_status = lv_label_create(hdr);
  lv_label_set_text(lbl_global_status, "WAITING FOR SENSOR...");
  lv_obj_set_style_text_color(lbl_global_status, lv_color_hex(0xF59E0B), 0);
  lv_obj_set_style_text_font(lbl_global_status, &lv_font_montserrat_12, 0);
  lv_obj_align(lbl_global_status, LV_ALIGN_RIGHT_MID, -6, 0);

  // Bottom Tabs Navigation Bar (Height: 46px)
  tabview = lv_tabview_create(scr, LV_DIR_BOTTOM, 46);
  lv_obj_set_pos(tabview, 0, 34);
  lv_obj_set_size(tabview, 480, 286);
  lv_obj_set_style_bg_color(tabview, lv_color_hex(0x0B0F19), 0);

  // Bottom Tab Buttons Styling
  lv_obj_t *tab_btns = lv_tabview_get_tab_btns(tabview);
  lv_obj_set_style_bg_color(tab_btns, lv_color_hex(0x131C31), 0);
  lv_obj_set_style_border_color(tab_btns, lv_color_hex(0x23314D), 0);
  lv_obj_set_style_border_width(tab_btns, 1, LV_PART_MAIN);
  lv_obj_set_style_text_color(tab_btns, lv_color_hex(0x94A3B8), 0);
  lv_obj_set_style_text_color(tab_btns, lv_color_hex(0x38BDF8), LV_STATE_CHECKED);
  lv_obj_set_style_text_font(tab_btns, &lv_font_montserrat_14, 0);

  // -----------------------------------------------------------------------
  // PAGE 1: LIVE MONITOR (Center Bada Emoji + Status + KPI Readings)
  // -----------------------------------------------------------------------
  tab_live = lv_tabview_add_tab(tabview, "Live Monitor");
  lv_obj_clear_flag(tab_live, LV_OBJ_FLAG_SCROLLABLE);

  // Left Column (PM2.5 & VOC)
  lbl_pm25_val = create_kpi_card(tab_live, 4, 6,  140, 98, "PM 2.5 DUST", "ug/m3", lv_color_hex(0x10B981));
  lbl_voc_val  = create_kpi_card(tab_live, 4, 110, 140, 98, "VOC LEVEL",   "Index", lv_color_hex(0xA855F7));

  // Right Column (CO2 & Temp/Hum)
  lbl_co2_val  = create_kpi_card(tab_live, 320, 6,   140, 98, "CO2 (NDIR)",   "ppm",   lv_color_hex(0x38BDF8));
  lbl_temp_val = create_kpi_card(tab_live, 320, 110, 140, 98, "TEMP & HUM",  "C / %", lv_color_hex(0xF59E0B));

  // CENTRE HERO STATUS CARD: BADA EMOJI AUR STATUS
  hero_card = lv_obj_create(tab_live);
  lv_obj_set_pos(hero_card, 150, 4);
  lv_obj_set_size(hero_card, 164, 206);
  lv_obj_set_style_bg_color(hero_card, lv_color_hex(0x131C31), 0);
  lv_obj_set_style_border_color(hero_card, lv_color_hex(0x10B981), 0);
  lv_obj_set_style_border_width(hero_card, 2, 0);
  lv_obj_set_style_radius(hero_card, 14, 0);
  lv_obj_set_style_pad_all(hero_card, 4, 0);
  lv_obj_clear_flag(hero_card, LV_OBJ_FLAG_SCROLLABLE);

  // Circular AQI Ring
  arc_aqi_ring = lv_arc_create(hero_card);
  lv_obj_set_size(arc_aqi_ring, 148, 148);
  lv_arc_set_rotation(arc_aqi_ring, 135);
  lv_arc_set_bg_angles(arc_aqi_ring, 0, 270);
  lv_arc_set_range(arc_aqi_ring, 0, 300);
  lv_arc_set_value(arc_aqi_ring, 50);
  lv_obj_remove_style(arc_aqi_ring, NULL, LV_PART_KNOB);
  lv_obj_clear_flag(arc_aqi_ring, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_arc_color(arc_aqi_ring, lv_color_hex(0x1E293B), LV_PART_MAIN);
  lv_obj_set_style_arc_color(arc_aqi_ring, lv_color_hex(0x10B981), LV_PART_INDICATOR);
  lv_obj_align(arc_aqi_ring, LV_ALIGN_CENTER, 0, -18);

  // CENTRE BADA EMOJI (Green 🙂 / Orange 😌 / Red 😩)
  lbl_bada_emoji = lv_label_create(hero_card);
  lv_label_set_text(lbl_bada_emoji, ":)"); // Defaults to happy face
  lv_obj_set_style_text_color(lbl_bada_emoji, lv_color_hex(0x10B981), 0);
  lv_obj_set_style_text_font(lbl_bada_emoji, &lv_font_montserrat_28, 0);
  lv_obj_align(lbl_bada_emoji, LV_ALIGN_CENTER, 0, -32);

  // AQI Value Text
  lbl_aqi_num = lv_label_create(hero_card);
  lv_label_set_text(lbl_aqi_num, "-- AQI");
  lv_obj_set_style_text_color(lbl_aqi_num, lv_color_hex(0xFFFFFF), 0);
  lv_obj_set_style_text_font(lbl_aqi_num, &lv_font_montserrat_16, 0);
  lv_obj_align(lbl_aqi_num, LV_ALIGN_CENTER, 0, 2);

  // Air Status Title
  lbl_air_status = lv_label_create(hero_card);
  lv_label_set_text(lbl_air_status, "GOOD");
  lv_obj_set_style_text_color(lbl_air_status, lv_color_hex(0x4ADE80), 0);
  lv_obj_set_style_text_font(lbl_air_status, &lv_font_montserrat_16, 0);
  lv_obj_align(lbl_air_status, LV_ALIGN_BOTTOM_MID, 0, -18);

  // Subtitle (Matching reference photo)
  lbl_status_desc = lv_label_create(hero_card);
  lv_label_set_text(lbl_status_desc, "Air quality is safe");
  lv_obj_set_style_text_color(lbl_status_desc, lv_color_hex(0x94A3B8), 0);
  lv_obj_set_style_text_font(lbl_status_desc, &lv_font_montserrat_10, 0);
  lv_obj_align(lbl_status_desc, LV_ALIGN_BOTTOM_MID, 0, -2);

  // Footnote for Live Monitor Page
  lv_obj_t *lbl_fn_live = lv_label_create(tab_live);
  lv_label_set_text(lbl_fn_live, "Designed and developed by SOCHI");
  lv_obj_set_style_text_color(lbl_fn_live, lv_color_hex(0x64748B), 0);
  lv_obj_set_style_text_font(lbl_fn_live, &lv_font_montserrat_10, 0);
  lv_obj_align(lbl_fn_live, LV_ALIGN_BOTTOM_MID, 0, -2);

  // -----------------------------------------------------------------------
  // PAGE 2: DATA ANALYTICS (Full Page Trend Charts)
  // -----------------------------------------------------------------------
  tab_analytics = lv_tabview_add_tab(tabview, "Data Analytics");
  lv_obj_clear_flag(tab_analytics, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *lbl_analytics_header = lv_label_create(tab_analytics);
  lv_label_set_text(lbl_analytics_header, "VAYU | TREND ANALYSIS");
  lv_obj_set_style_text_color(lbl_analytics_header, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_analytics_header, &lv_font_montserrat_12, 0);
  lv_obj_set_pos(lbl_analytics_header, 8, 4);

  // Compact Navigation Arrows: < (Live Monitor) and > (Settings)
  lv_obj_t *btn_prev = lv_btn_create(tab_analytics);
  lv_obj_set_pos(btn_prev, 395, 2);
  lv_obj_set_size(btn_prev, 28, 20);
  lv_obj_set_style_bg_color(btn_prev, lv_color_hex(0x1E293B), 0);
  lv_obj_set_style_border_color(btn_prev, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_border_width(btn_prev, 1, 0);
  lv_obj_set_style_radius(btn_prev, 4, 0);
  lv_obj_set_style_pad_all(btn_prev, 0, 0);
  lv_obj_add_event_cb(btn_prev, back_to_live_btn_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *lbl_prev = lv_label_create(btn_prev);
  lv_label_set_text(lbl_prev, "<");
  lv_obj_set_style_text_color(lbl_prev, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_prev, &lv_font_montserrat_12, 0);
  lv_obj_center(lbl_prev);

  lv_obj_t *btn_next = lv_btn_create(tab_analytics);
  lv_obj_set_pos(btn_next, 428, 2);
  lv_obj_set_size(btn_next, 28, 20);
  lv_obj_set_style_bg_color(btn_next, lv_color_hex(0x1E293B), 0);
  lv_obj_set_style_border_color(btn_next, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_border_width(btn_next, 1, 0);
  lv_obj_set_style_radius(btn_next, 4, 0);
  lv_obj_set_style_pad_all(btn_next, 0, 0);
  lv_obj_add_event_cb(btn_next, next_tab_settings_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *lbl_next = lv_label_create(btn_next);
  lv_label_set_text(lbl_next, ">");
  lv_obj_set_style_text_color(lbl_next, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_next, &lv_font_montserrat_12, 0);
  lv_obj_center(lbl_next);

  chart_history = lv_chart_create(tab_analytics);
  lv_obj_set_pos(chart_history, 8, 24);
  lv_obj_set_size(chart_history, 450, 150);
  lv_chart_set_type(chart_history, LV_CHART_TYPE_LINE);
  lv_chart_set_point_count(chart_history, 40);
  lv_chart_set_range(chart_history, LV_CHART_AXIS_PRIMARY_Y, 400, 1800);
  lv_obj_set_style_bg_color(chart_history, lv_color_hex(0x131C31), 0);
  lv_obj_set_style_border_color(chart_history, lv_color_hex(0x23314D), 0);
  lv_obj_set_style_line_color(chart_history, lv_color_hex(0x1E293B), LV_PART_MAIN);
  lv_obj_set_style_size(chart_history, 0, LV_PART_INDICATOR);

  ser_co2_hist  = lv_chart_add_series(chart_history, lv_color_hex(0x38BDF8), LV_CHART_AXIS_PRIMARY_Y);
  ser_pm25_hist = lv_chart_add_series(chart_history, lv_color_hex(0x10B981), LV_CHART_AXIS_PRIMARY_Y);

  lv_obj_t *lbl_legend = lv_label_create(tab_analytics);
  lv_label_set_text(lbl_legend, "[CYAN]: CO2 ppm (400-1800)   |   [GREEN]: PM2.5 ug/m3   |   Live Auto-Plot");
  lv_obj_set_style_text_color(lbl_legend, lv_color_hex(0x94A3B8), 0);
  lv_obj_set_style_text_font(lbl_legend, &lv_font_montserrat_10, 0);
  lv_obj_set_pos(lbl_legend, 12, 178);

  // Footnote for Data Analytics Page
  lv_obj_t *lbl_fn_analytics = lv_label_create(tab_analytics);
  lv_label_set_text(lbl_fn_analytics, "Designed and developed by SOCHI");
  lv_obj_set_style_text_color(lbl_fn_analytics, lv_color_hex(0x64748B), 0);
  lv_obj_set_style_text_font(lbl_fn_analytics, &lv_font_montserrat_10, 0);
  lv_obj_align(lbl_fn_analytics, LV_ALIGN_BOTTOM_MID, 0, -2);

  // -----------------------------------------------------------------------
  // PAGE 3: SETTINGS (Full Page Touch Configuration & Hardware Info)
  // -----------------------------------------------------------------------
  tab_settings = lv_tabview_add_tab(tabview, "Settings");
  lv_obj_clear_flag(tab_settings, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *settings_box = lv_obj_create(tab_settings);
  lv_obj_set_pos(settings_box, 8, 4);
  lv_obj_set_size(settings_box, 450, 196);
  lv_obj_set_style_bg_color(settings_box, lv_color_hex(0x131C31), 0);
  lv_obj_set_style_border_color(settings_box, lv_color_hex(0x23314D), 0);
  lv_obj_set_style_radius(settings_box, 10, 0);
  lv_obj_set_style_pad_all(settings_box, 12, 0);
  lv_obj_clear_flag(settings_box, LV_OBJ_FLAG_SCROLLABLE);

  // Brightness Touch Control
  lv_obj_t *lbl_b_title = lv_label_create(settings_box);
  lv_label_set_text(lbl_b_title, "VAYU | DISPLAY BRIGHTNESS");
  lv_obj_set_style_text_color(lbl_b_title, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_b_title, &lv_font_montserrat_12, 0);
  lv_obj_set_pos(lbl_b_title, 0, 0);

  // Compact Navigation Arrows: < (Analytics) and > (Live)
  lv_obj_t *btn_s_prev = lv_btn_create(settings_box);
  lv_obj_set_pos(btn_s_prev, 360, 0);
  lv_obj_set_size(btn_s_prev, 28, 20);
  lv_obj_set_style_bg_color(btn_s_prev, lv_color_hex(0x1E293B), 0);
  lv_obj_set_style_border_color(btn_s_prev, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_border_width(btn_s_prev, 1, 0);
  lv_obj_set_style_radius(btn_s_prev, 4, 0);
  lv_obj_set_style_pad_all(btn_s_prev, 0, 0);
  lv_obj_add_event_cb(btn_s_prev, prev_tab_analytics_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *lbl_s_prev = lv_label_create(btn_s_prev);
  lv_label_set_text(lbl_s_prev, "<");
  lv_obj_set_style_text_color(lbl_s_prev, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_s_prev, &lv_font_montserrat_12, 0);
  lv_obj_center(lbl_s_prev);

  lv_obj_t *btn_s_next = lv_btn_create(settings_box);
  lv_obj_set_pos(btn_s_next, 394, 0);
  lv_obj_set_size(btn_s_next, 28, 20);
  lv_obj_set_style_bg_color(btn_s_next, lv_color_hex(0x1E293B), 0);
  lv_obj_set_style_border_color(btn_s_next, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_border_width(btn_s_next, 1, 0);
  lv_obj_set_style_radius(btn_s_next, 4, 0);
  lv_obj_set_style_pad_all(btn_s_next, 0, 0);
  lv_obj_add_event_cb(btn_s_next, back_to_live_btn_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *lbl_s_next = lv_label_create(btn_s_next);
  lv_label_set_text(lbl_s_next, ">");
  lv_obj_set_style_text_color(lbl_s_next, lv_color_hex(0x38BDF8), 0);
  lv_obj_set_style_text_font(lbl_s_next, &lv_font_montserrat_12, 0);
  lv_obj_center(lbl_s_next);

  slider_brightness = lv_slider_create(settings_box);
  lv_slider_set_range(slider_brightness, 20, 255);
  lv_slider_set_value(slider_brightness, 220, LV_ANIM_OFF);
  lv_obj_set_pos(slider_brightness, 0, 24);
  lv_obj_set_size(slider_brightness, 330, 14);
  lv_obj_set_style_bg_color(slider_brightness, lv_color_hex(0x1E293B), LV_PART_MAIN);
  lv_obj_set_style_bg_color(slider_brightness, lv_color_hex(0x38BDF8), LV_PART_INDICATOR);
  lv_obj_add_event_cb(slider_brightness, brightness_slider_cb, LV_EVENT_VALUE_CHANGED, NULL);

  lbl_brightness_val = lv_label_create(settings_box);
  lv_label_set_text(lbl_brightness_val, "86%");
  lv_obj_set_style_text_color(lbl_brightness_val, lv_color_hex(0xFFFFFF), 0);
  lv_obj_set_pos(lbl_brightness_val, 345, 22);

  // Diagnostics Box
  lv_obj_t *lbl_info = lv_label_create(settings_box);
  lv_obj_set_pos(lbl_info, 0, 50);
  lv_obj_set_style_text_color(lbl_info, lv_color_hex(0x94A3B8), 0);
  lv_obj_set_style_text_font(lbl_info, &lv_font_montserrat_12, 0);
  lv_label_set_text(lbl_info,
    "HARDWARE STATUS & SENSOR DIAGNOSTICS:\n"
    "* Microcontroller: ESP32-S3 Dual-Core @ 240 MHz\n"
    "* Memory: 8MB Flash + 8MB OPI PSRAM (Active DMA Buffering)\n"
    "* Screen: ST7796S 480x320 SPI + FT6336U Capacitive Touch\n"
    "* Sensor: CUBIC AM1008W (UART1 on GPIO 18 RX / GPIO 17 TX)\n"
    "* USB Telemetry: 115200 Baud (WebSerial Ingest Enabled)"
  );

  // Footnote for Settings Page
  lv_obj_t *lbl_fn_settings = lv_label_create(tab_settings);
  lv_label_set_text(lbl_fn_settings, "Designed and developed by SOCHI");
  lv_obj_set_style_text_color(lbl_fn_settings, lv_color_hex(0x64748B), 0);
  lv_obj_set_style_text_font(lbl_fn_settings, &lv_font_montserrat_10, 0);
  lv_obj_align(lbl_fn_settings, LV_ALIGN_BOTTOM_MID, 0, -2);
}

// =========================================================================
// 5. SENSOR UART POLLING & REACTION LOGIC (Green 🙂 / Orange 😌 / Red 😩)
// =========================================================================
void poll_am1008w() {
  while (Serial1.available()) Serial1.read();
  Serial1.write(POLL_CMD, 5);
  delay(90);

  int len = 0;
  while (Serial1.available() && len < 64) {
    rxBuf[len++] = Serial1.read();
  }

  if (len >= 16 && rxBuf[0] == 0x16) {
    uint32_t sum = 0;
    for (int i = 0; i < len - 1; i++) sum += rxBuf[i];
    uint8_t cs = (256 - (sum % 256)) & 0xFF;

    if (cs == rxBuf[len - 1] || rxBuf[0] == 0x16) {
      if (rxBuf[1] >= 0x14) {
        // 24-byte full IAQ packet
        vayuData.co2  = (rxBuf[3] << 8) | rxBuf[4];
        vayuData.voc  = (rxBuf[5] << 8) | rxBuf[6];
        vayuData.pm25 = (rxBuf[9] << 8) | rxBuf[10];

        int16_t raw_t = (rxBuf[13] << 8) | rxBuf[14];
        vayuData.temp = (raw_t >= 500) ? ((raw_t - 500) / 10.0f) : (raw_t / 10.0f);
        vayuData.hum  = ((rxBuf[15] << 8) | rxBuf[16]) / 10.0f;
      } else {
        // 16-byte compact packet
        vayuData.co2  = (rxBuf[3] << 8) | rxBuf[4];
        vayuData.pm25 = (rxBuf[5] << 8) | rxBuf[6];
        int16_t raw_t = (rxBuf[7] << 8) | rxBuf[8];
        vayuData.temp = (raw_t >= 500) ? ((raw_t - 500) / 10.0f) : (raw_t / 10.0f);
        vayuData.hum  = ((rxBuf[9] << 8) | rxBuf[10]) / 10.0f;
        vayuData.voc  = (rxBuf[11] << 8) | rxBuf[12];
      }

      if (vayuData.co2 > 0 || vayuData.pm25 > 0 || vayuData.temp > 0.0f) {
        vayuData.connected = true;
        vayuData.lastValidPacketMs = millis();
      }

      // Output to USB-C for laptop dashboard
      Serial.printf("DATA:{\"co2\":%u,\"pm25\":%u,\"temp\":%.1f,\"hum\":%.1f,\"voc\":%u,\"sensor\":\"CONNECTED\"}\n",
                    vayuData.co2, vayuData.pm25, vayuData.temp, vayuData.hum, vayuData.voc);
    }
  }
}

void update_ui_values() {
  // If sensor not responding > 3.5s
  if (!vayuData.connected || (millis() - vayuData.lastValidPacketMs > 3500)) {
    vayuData.connected = false;
    lv_label_set_text(lbl_global_status, "SENSOR DISCONNECTED");
    lv_obj_set_style_text_color(lbl_global_status, lv_color_hex(0xEF4444), 0);

    lv_label_set_text(lbl_bada_emoji, "--");
    lv_obj_set_style_text_color(lbl_bada_emoji, lv_color_hex(0x64748B), 0);
    lv_label_set_text(lbl_aqi_num, "NO SENSOR");
    lv_label_set_text(lbl_air_status, "CHECK PINS 18/17");
    lv_obj_set_style_text_color(lbl_air_status, lv_color_hex(0xEF4444), 0);
    lv_obj_set_style_border_color(hero_card, lv_color_hex(0xEF4444), 0);
    lv_arc_set_value(arc_aqi_ring, 0);

    lv_label_set_text(lbl_pm25_val, "--");
    lv_label_set_text(lbl_voc_val,  "--");
    lv_label_set_text(lbl_co2_val,  "--");
    lv_label_set_text(lbl_temp_val, "-- / --");
    return;
  }

  lv_label_set_text(lbl_global_status, "LIVE TELEMETRY");
  lv_obj_set_style_text_color(lbl_global_status, lv_color_hex(0x10B981), 0);

  // Update KPI Cards
  lv_label_set_text_fmt(lbl_pm25_val, "%u", vayuData.pm25);
  lv_label_set_text_fmt(lbl_voc_val,  "%u", vayuData.voc);
  lv_label_set_text_fmt(lbl_co2_val,  "%u", vayuData.co2);
  lv_label_set_text_fmt(lbl_temp_val, "%.1fC | %.0f%%", vayuData.temp, vayuData.hum);

  // Compute composite AQI
  int aqi = max((int)(vayuData.pm25 * 2.5f), (int)(vayuData.co2 / 12.0f));
  aqi = constrain(aqi, 0, 300);
  lv_arc_set_value(arc_aqi_ring, aqi);
  lv_label_set_text_fmt(lbl_aqi_num, "%d AQI", aqi);

  // =======================================================================
  // EMOJI & STATUS CLASSIFICATION:
  // Green 🙂  — Good air quality
  // Orange 😌 — Moderate air quality
  // Red 😩    — Poor air quality
  // =======================================================================
  if (vayuData.co2 < 800 && vayuData.pm25 < 15) {
    // 🟢 Green 🙂 — Good Air Quality (Matches Reference Photo)
    lv_label_set_text(lbl_bada_emoji, ":)"); 
    lv_obj_set_style_text_color(lbl_bada_emoji, lv_color_hex(0x4ADE80), 0);
    lv_label_set_text(lbl_air_status, "GOOD");
    lv_obj_set_style_text_color(lbl_air_status, lv_color_hex(0x4ADE80), 0);
    lv_label_set_text(lbl_status_desc, "Air quality is within safe range");
    lv_obj_set_style_text_color(lbl_status_desc, lv_color_hex(0xA7F3D0), 0);
    lv_obj_set_style_bg_color(tab_live, lv_color_hex(0x0E3822), 0);
    lv_obj_set_style_border_color(hero_card, lv_color_hex(0x4ADE80), 0);
    lv_obj_set_style_arc_color(arc_aqi_ring, lv_color_hex(0x4ADE80), LV_PART_INDICATOR);
  } 
  else if (vayuData.co2 < 1200 && vayuData.pm25 < 35) {
    // 🟠 Orange 😌 — Moderate Air Quality (Matches Reference Photo)
    lv_label_set_text(lbl_bada_emoji, ":|"); 
    lv_obj_set_style_text_color(lbl_bada_emoji, lv_color_hex(0xFBBF24), 0);
    lv_label_set_text(lbl_air_status, "MODERATE");
    lv_obj_set_style_text_color(lbl_air_status, lv_color_hex(0xFBBF24), 0);
    lv_label_set_text(lbl_status_desc, "Air quality above preferred range");
    lv_obj_set_style_text_color(lbl_status_desc, lv_color_hex(0xFDE68A), 0);
    lv_obj_set_style_bg_color(tab_live, lv_color_hex(0x452603), 0);
    lv_obj_set_style_border_color(hero_card, lv_color_hex(0xFBBF24), 0);
    lv_obj_set_style_arc_color(arc_aqi_ring, lv_color_hex(0xFBBF24), LV_PART_INDICATOR);
  } 
  else {
    // 🔴 Red 😩 — Poor Air Quality (Matches Reference Photo)
    lv_label_set_text(lbl_bada_emoji, ":("); 
    lv_obj_set_style_text_color(lbl_bada_emoji, lv_color_hex(0xF87171), 0);
    lv_label_set_text(lbl_air_status, "POOR");
    lv_obj_set_style_text_color(lbl_air_status, lv_color_hex(0xF87171), 0);
    lv_label_set_text(lbl_status_desc, "Air quality is unhealthy. Ventilate!");
    lv_obj_set_style_text_color(lbl_status_desc, lv_color_hex(0xFECACA), 0);
    lv_obj_set_style_bg_color(tab_live, lv_color_hex(0x420911), 0);
    lv_obj_set_style_border_color(hero_card, lv_color_hex(0xF87171), 0);
    lv_obj_set_style_arc_color(arc_aqi_ring, lv_color_hex(0xF87171), LV_PART_INDICATOR);
  }

  // Push into Analytics history chart
  lv_chart_set_next_value(chart_history, ser_co2_hist, vayuData.co2);
  lv_chart_set_next_value(chart_history, ser_pm25_hist, 400 + (vayuData.pm25 * 10));
}

// =========================================================================
// 6. SETUP & EXECUTION LOOP
// =========================================================================
void setup() {
  Serial.begin(115200);
  Serial1.begin(9600, SERIAL_8N1, SENSOR_RX_PIN, SENSOR_TX_PIN);

  tft.init();
  tft.setBrightness(220);

  lv_init();

  // Buffer allocation in PSRAM
  buf1 = (lv_color_t *)ps_malloc(screenWidth * 40 * sizeof(lv_color_t));
  if (!buf1) {
    buf1 = (lv_color_t *)malloc(screenWidth * 40 * sizeof(lv_color_t));
  }
  lv_disp_draw_buf_init(&draw_buf, buf1, NULL, screenWidth * 40);

  static lv_disp_drv_t disp_drv;
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res  = screenWidth;
  disp_drv.ver_res  = screenHeight;
  disp_drv.flush_cb = my_disp_flush;
  disp_drv.draw_buf = &draw_buf;
  lv_disp_drv_register(&disp_drv);

  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type    = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = my_touchpad_read;
  lv_indev_drv_register(&indev_drv);

  build_vayu_dashboard();
}

unsigned long lastPollMs = 0;

void loop() {
  lv_timer_handler();

  if (millis() - lastPollMs >= 1500) {
    lastPollMs = millis();
    poll_am1008w();
    update_ui_values();
  }

  delay(5);
}
