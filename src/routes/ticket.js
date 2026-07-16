const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase').service
const router = Router()

router.post('/new', requireAuth, async (req, res) => {
    try {
        const subject = req.body.subject
        const section = req.body.section
        if (!subject) {
            return res.status(400).json({ success: false, error: { message: "Please provide a subject and a body for your ticket" } })
        }
        const ticket = { active: true, user_id: req.user.id, subject, section, created_at: new Date().toISOString() }
        const { data, error } = await supabase.from('tickets').insert(ticket).select().single()
        if (error) return res.status(500).json({ success: false, error: error.message })
        res.json({ success: true, ticket: data })
    } catch (err) {
        console.error('Ticket creation error:', err)
        res.status(500).json({ success: false, error: 'Failed to create ticket' })
    }
})

router.post('/:ticketId/close', requireAuth, async (req, res) => {
    try {
        const ticketId = req.params.ticketId
        const { error } = await supabase.from('tickets').update({ active: false }).eq('id', ticketId).eq('user_id', req.user.id)
        if (error) return res.status(500).json({ success: false, error: error.message })
        res.json({ success: true })
    } catch (err) {
        console.error('Ticket close error:', err)
        res.status(500).json({ success: false, error: 'Failed to close ticket' })
    }
})

router.post('/:ticketId/comment', requireAuth, async (req, res) => {
    try {
        const ticketId = req.params.ticketId
        const { content } = req.body
        if (!content) return res.status(400).json({ success: false, error: 'Comment content required' })
        const { error } = await supabase.from('ticket_messages').insert({ ticket_id: ticketId, user_id: req.user.id, content, created_at: new Date().toISOString() })
        if (error) return res.status(500).json({ success: false, error: error.message })
        res.json({ success: true })
    } catch (err) {
        console.error('Ticket comment error:', err)
        res.status(500).json({ success: false, error: 'Failed to add comment' })
    }
})

router.get('/:ticketId', requireAuth, async (req, res) => {
    try {
        const ticketId = req.params.ticketId
        const { data: ticket, error } = await supabase.from('tickets').select('*').eq('id', ticketId).eq('user_id', req.user.id).single()
        if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' })
        const { data: comments } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
        res.json({ ticket, comments: comments || [] })
    } catch (err) {
        console.error('Ticket fetch error:', err)
        res.status(500).json({ error: 'Failed to fetch ticket' })
    }
})

module.exports = router