const DisplayService = require('../services/display.service');

// Slides are sent as multipart (JSON in a `data` field + optional `image` file) when an image is
// attached, and as plain JSON otherwise (e.g. toggling a slide on/off).
function readSlideData(req) {
  const body = req.body || {};
  if (typeof body.data !== 'string') return body;
  try {
    const data = JSON.parse(body.data);
    return data && typeof data === 'object' ? data : {};
  } catch {
    const err = new Error('بيانات الشريحة غير صالحة');
    err.status = 400;
    throw err;
  }
}

function sendError(res, err) {
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first ? first.message : 'بيانات غير صالحة' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'بيانات غير صالحة' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('Display screen error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

class DisplayController {
  // Public: what the screen in the library shows.
  async getScreen(req, res) {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await DisplayService.getScreen());
    } catch (err) {
      sendError(res, err);
    }
  }

  // Public: slide images. Every upload gets a new id, so they can be cached forever.
  async getMedia(req, res) {
    try {
      const media = await DisplayService.getMedia(req.params.id);
      if (!media) return res.status(404).json({ error: 'Not found' });
      res.set({
        'Content-Type': media.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      return res.send(media.data);
    } catch (err) {
      return sendError(res, err);
    }
  }

  async getAdminData(req, res) {
    try {
      res.json(await DisplayService.getAdminData());
    } catch (err) {
      sendError(res, err);
    }
  }

  async updateSettings(req, res) {
    try {
      res.json(await DisplayService.updateSettings(req.body));
    } catch (err) {
      sendError(res, err);
    }
  }

  async createSlide(req, res) {
    try {
      const slide = await DisplayService.createSlide(readSlideData(req), req.file);
      res.status(201).json(slide);
    } catch (err) {
      sendError(res, err);
    }
  }

  async updateSlide(req, res) {
    try {
      const slide = await DisplayService.updateSlide(req.params.id, readSlideData(req), req.file);
      if (!slide) return res.status(404).json({ error: 'الشريحة غير موجودة' });
      return res.json(slide);
    } catch (err) {
      return sendError(res, err);
    }
  }

  async deleteSlide(req, res) {
    try {
      const slide = await DisplayService.deleteSlide(req.params.id);
      if (!slide) return res.status(404).json({ error: 'الشريحة غير موجودة' });
      return res.json({ message: 'تم حذف الشريحة' });
    } catch (err) {
      return sendError(res, err);
    }
  }

  async reorderSlides(req, res) {
    try {
      await DisplayService.reorderSlides(req.body && req.body.ids);
      res.json({ message: 'تم حفظ الترتيب' });
    } catch (err) {
      sendError(res, err);
    }
  }
}

module.exports = new DisplayController();
