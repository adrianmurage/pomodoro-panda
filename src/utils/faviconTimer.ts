
  /**
   * Creates a data URL for the donut-shaped timer favicon
   * 
   * This function generates the visual representation of the timer as a donut shape:
   * - Uses canvas to draw a donut with a progress arc
   * - Changes color based on timer state (red for active, blue for paused)
   * - Adjusts to different sizes for browser compatibility
   * 
   * @param {boolean} isRunning - Whether the timer is currently running
   * @param {number} progress - Current progress value (0 to 1)
   * @param {number} size - Size of the favicon in pixels (default: 32)
   * @returns {string} Data URL of the generated favicon image
   */
const createDonutTimerDataURL = (isRunning: boolean, progress: number, size: number = 32) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        throw new Error('Failed to create canvas context')
    }

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, size, size)

    // Calculate dimensions using relative proportions for different sizes
    const centerX = size / 2
    const centerY = size / 2
    const radius = Math.floor(size * 0.42); // Smaller than canvas for better visibility
    const lineWidth = Math.floor(size * 0.19) // Thick line for better visibility at small sizes

    // Set line width for the donut shape
    ctx.lineWidth = lineWidth

    // Draw background circle (translucent light color)
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    // Use a light red color for the background when active, light orange when paused
    ctx.strokeStyle = isRunning ? 'rgba(255, 0, 0, 0.3)' : 'rgba(236, 165, 98, 0.5)'
    ctx.stroke()

    // Draw progress arc - only if there is progress to show
    if (progress > 0){
        ctx.beginPath()
        // Start from top (-Math.PI / 2) and draw clockwise
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (progress * 2 * Math.PI))
        // Use dark red when active, dark orange when paused for better contrast
        ctx.strokeStyle = isRunning ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 123, 0)';
        ctx.stroke()
    }
    return canvas.toDataURL('image/png')
}